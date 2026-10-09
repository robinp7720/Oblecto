import type { Express } from 'express';
import type Oblecto from '../../../../lib/oblecto/index.js';
import type { OblectoRequest } from '../../index.js';
import auth from '../../middleware/auth.js';
import errors from '../../errors.js';
import { StatisticsQueries, readPeriod } from '../../../../lib/statistics/queries.js';

export default (server: Express, oblecto: Oblecto): void => {
    const queries = new StatisticsQueries(oblecto.database);
    for (const scope of ['me', 'server'] as const) {
        const guard = scope === 'me' ? auth.requiresAuth : auth.requiresPermission('statistics.view');
        for (const view of ['summary', 'history'] as const) {
            server.get(`/api/v1/statistics/${scope}/${view}`, guard, async (req: OblectoRequest, res) => {
                const principal = req.authorization?.user as { id?: number } | undefined;
                const userId = scope === 'me' ? Number(principal?.id) : req.query.userId === undefined ? undefined : Number(req.query.userId);
                if (userId !== undefined && (!Number.isSafeInteger(userId) || userId <= 0)) throw new errors.BadRequestError('Invalid userId');
                const period = readPeriod(req.query, userId);
                const data = view === 'summary' ? await queries.summary(period) : await queries.history(period, req.query);
                res.send({ ...data, collection: { degraded: oblecto.statistics.degraded, lastFailureAt: oblecto.statistics.lastFailureAt } });
            });
        }
    }
    server.get('/api/v1/statistics/server/library', auth.requiresPermission('statistics.view'), async (_req, res) => { res.send(await queries.library()); });
    server.get('/api/v1/statistics/server/health', auth.requiresPermission('statistics.view'), async (req, res) => { res.send(await queries.health(readPeriod(req.query))); });
};
