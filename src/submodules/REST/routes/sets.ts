import type { Express, Response } from 'express';
import { Op } from 'sequelize';
import errors from '../errors.js';
import authMiddleWare from '../middleware/auth.js';
import { MovieSet } from '../../../models/movieSet.js';
import { SeriesSet } from '../../../models/seriesSet.js';
import { visibleMovieSets, visibleSeriesSets } from '../../../lib/sets/visibility.js';
import type Oblecto from '../../../lib/oblecto/index.js';
import type { OblectoRequest } from '../index.js';

type SetInput = { name: string; overview: string | null; public: boolean };

function validateSetInput(input: unknown): SetInput {
    const params = input as Record<string, unknown> | undefined;
    if (typeof params?.public !== 'boolean') throw new errors.InvalidArgumentError('Argument public is not a boolean');
    if (typeof params.name !== 'string' || !params.name.trim() || params.name.trim().length > 255) {
        throw new errors.InvalidArgumentError('Argument name must be a non-empty string of up to 255 characters');
    }
    if (params.overview !== undefined && params.overview !== null && typeof params.overview !== 'string') {
        throw new errors.InvalidArgumentError('Argument overview must be text or null');
    }
    return {
        name: params.name.trim(),
        overview: params.overview ?? null,
        public: params.public
    };
}

export default (server: Express, _oblecto: Oblecto): void => {
    server.post('/set/movie', authMiddleWare.requiresPermission('libraries.manage'), async function (req: OblectoRequest, res: Response) {
        const params = validateSetInput(req.combined_params);
        const userId = req.authorization!.principal!.id;
        const set = await MovieSet.sequelize!.transaction(async transaction => {
            const [set, created] = await MovieSet.findOrCreate({
                where: { setName: params.name },
                defaults: { overview: params.overview, public: params.public },
                transaction
            });
            if (created) await set.addUser(userId, { transaction });
            else if (!await MovieSet.findOne({ where: { [Op.and]: [{ id: set.id }, visibleMovieSets(userId)] }, transaction })) {
                throw new errors.NotFoundError('Set not found');
            }
            return set;
        });
        res.send(set);
    });

    server.post('/set/series', authMiddleWare.requiresPermission('libraries.manage'), async function (req: OblectoRequest, res: Response) {
        const params = validateSetInput(req.combined_params);
        const userId = req.authorization!.principal!.id;
        const set = await SeriesSet.sequelize!.transaction(async transaction => {
            const [set, created] = await SeriesSet.findOrCreate({
                where: { setName: params.name },
                defaults: { overview: params.overview, public: params.public },
                transaction
            });
            if (created) await set.addUser(userId, { transaction });
            else if (!await SeriesSet.findOne({ where: { [Op.and]: [{ id: set.id }, visibleSeriesSets(userId)] }, transaction })) {
                throw new errors.NotFoundError('Set not found');
            }
            return set;
        });
        res.send(set);
    });

    server.delete('/set/movie/:id', authMiddleWare.requiresPermission('libraries.manage'), async function (req: OblectoRequest, res: Response) {
        const set = await MovieSet.findByPk(req.params.id as string);
        if (!set) throw new errors.NotFoundError('Set not found');
        await set.destroy();
        res.send({ success: true });
    });

    server.delete('/set/series/:id', authMiddleWare.requiresPermission('libraries.manage'), async function (req: OblectoRequest, res: Response) {
        const set = await SeriesSet.findByPk(req.params.id as string);
        if (!set) throw new errors.NotFoundError('Set not found');
        await set.destroy();
        res.send({ success: true });
    });
};
