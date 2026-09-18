/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import type Oblecto from '../../../../lib/oblecto/index.js';
import { maintenanceWork } from '../../../../lib/maintenance/dispatch.js';

export default (server: Express, oblecto: any) => {

    server.get('/api/v1/system/maintenance/jobs', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        res.send(oblecto.queue.maintenance.list());
    });
    server.post('/api/v1/system/maintenance', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        const { action, target } = (req.body ?? {}) as { action?: unknown; target?: unknown };
        if (typeof action !== 'string' || typeof target !== 'string') return res.status(400).send({ error: 'Action and target are required' });
        const work = maintenanceWork(oblecto as Oblecto, action, target);
        if (!work) return res.status(400).send({ error: 'Invalid maintenance action or target' });
        const canonicalTarget = target === 'tvshows' && ['scan', 'update_artwork'].includes(action) ? 'series' : target;
        const job = oblecto.queue.maintenance.start(action, canonicalTarget, work);
        res.send({
            success: true,
            message: 'Maintenance job accepted',
            job
        });
    });

    // POST /api/v1/system/imports
    server.post('/api/v1/system/imports', authMiddleWare.requiresAuth, async (req: Request, res: Response, next: NextFunction) => {
        const { source, type } = req.body;

        if (!type) return next(new errors.BadRequestError('Type is required (movies|tvshows)'));
        
        const device = source || 'all'; // Default to all
        const getSeedbox = () => {
            if (device === 'all') return null;
            const byIndex = oblecto.seedboxController.seedBoxes[device];

            if (byIndex) return byIndex;
            return oblecto.seedboxController.seedBoxes.find((seedbox: { name?: string }) => seedbox.name === device) || null;
        };

        try {
            if (type === 'movies') {
                if (device === 'all') {
                    oblecto.seedboxController.importAllMovies();
                } else {
                    const seedbox = getSeedbox();

                    if (!seedbox) return next(new errors.NotFoundError(`Seedbox '${device}' not found`));
                    oblecto.seedboxController.importMovies(seedbox);
                }
            } else if (type === 'tvshows') {
                if (device === 'all') {
                    oblecto.seedboxController.importAllEpisodes();
                } else {
                    const seedbox = getSeedbox();

                    if (!seedbox) return next(new errors.NotFoundError(`Seedbox '${device}' not found`));
                    oblecto.seedboxController.importEpisodes(seedbox);
                }
            } else {
                return next(new errors.BadRequestError('Invalid type'));
            }

            res.send({ success: true, message: `Import triggered for '${type}' from '${device}'` });

        } catch (err) {
            next(err);
        }
    });

    // GET /api/v1/system/info
    server.get('/api/v1/system/info', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        const info = {
            version: process.env.npm_package_version || 'unknown',
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            nodeVersion: process.version,
            memory: process.memoryUsage()
        };

        res.send(info);
    });

    // GET /api/v1/system/capabilities
    server.get('/api/v1/system/capabilities', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        res.send({
            movies: {
                identifiers: oblecto.movieIndexer.availableIdentifiers,
                updaters: oblecto.movieUpdater.availableUpdaters
            },
            tvshows: {
                seriesIdentifiers: oblecto.seriesIndexer.availableSeriesIdentifiers,
                episodeIdentifiers: oblecto.seriesIndexer.availableEpisodeIdentifiers,
                seriesUpdaters: oblecto.seriesUpdater.availableSeriesUpdaters,
                episodeUpdaters: oblecto.seriesUpdater.availableEpisodeUpdaters
            }
        });
    });
};
