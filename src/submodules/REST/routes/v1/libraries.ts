import { libraryStatistics } from '../../../../lib/statistics/libraries.js';
import { Express, Response, NextFunction } from 'express';
import type { OblectoRequest } from '../../index.js';
import type Oblecto from '../../../../lib/oblecto/index.js';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import { mergeSettings, validateSettings } from '../../../../lib/settings/validation.js';
import { ConfigManager } from '../../../../config.js';

const isLibrary = (value: string): value is 'movies' | 'tvshows' => value === 'movies' || value === 'tvshows';

export default (server: Express, oblecto: Pick<Oblecto, 'config' | 'database'>): void => {

    // GET /api/v1/libraries
    server.get('/api/v1/libraries', authMiddleWare.requiresAuth, (req: OblectoRequest, res: Response) => {
        const libs = { movies: oblecto.config.movies, tvshows: oblecto.config.tvshows };
        res.send(libs);
    });

    server.get('/api/v1/libraries/statistics', authMiddleWare.requiresPermission('libraries.manage'), async (_req, res) => {
        res.send({ libraries: await libraryStatistics(oblecto.database, oblecto.config) });
    });

    // GET /api/v1/libraries/:type
    server.get('/api/v1/libraries/:type', authMiddleWare.requiresAuth, (req: OblectoRequest, res: Response, next: NextFunction) => {
        const type = req.params.type;

        if (!isLibrary(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }
        res.send(oblecto.config[type].directories || []);
    });

    // PATCH /api/v1/libraries/:type - Update general library settings (identifiers, updaters, etc)
    server.patch('/api/v1/libraries/:type', authMiddleWare.requiresPermission('libraries.manage'), async (req: OblectoRequest, res: Response, next: NextFunction) => {
        const type = req.params.type;

        if (!isLibrary(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        const fields = validateSettings({ [type]: updates }, { ...oblecto.config });
        if (Object.keys(fields).length) return res.status(400).send({ error: 'Check library settings.', fields });
        await ConfigManager.updateConfig(draft => mergeSettings(draft, { [type]: updates }), oblecto.config);

        res.send(oblecto.config[type]);
    });

    // POST /api/v1/libraries/:type/paths - Add a source directory
    server.post('/api/v1/libraries/:type/paths', authMiddleWare.requiresPermission('libraries.manage'), async (req: OblectoRequest, res: Response, next: NextFunction) => {
        const type = req.params.type;

        if (!isLibrary(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body || {};

        if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
            return next(new errors.BadRequestError('Path is required'));
        }

        await ConfigManager.updateConfig(draft => {
            const library = draft[type];
            library.directories ??= [];
            if (library.directories.some(d => d.path === path)) throw new errors.ConflictError('Path already exists');
            library.directories.push({ path });
        }, oblecto.config);
        res.send(oblecto.config[type].directories);
    });

    // DELETE /api/v1/libraries/:type/paths - Remove a source directory
    server.delete('/api/v1/libraries/:type/paths', authMiddleWare.requiresPermission('libraries.manage'), async (req: OblectoRequest, res: Response, next: NextFunction) => {
        const type = req.params.type;

        if (!isLibrary(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body || {};

        if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
            return next(new errors.BadRequestError('Path is required'));
        }

        await ConfigManager.updateConfig(draft => {
            const library = draft[type];
            library.directories ??= [];
            const index = library.directories.findIndex(d => d.path === path);
            if (index === -1) throw new errors.NotFoundError('Path not found');
            library.directories.splice(index, 1);
        }, oblecto.config);
        res.send(oblecto.config[type].directories);
    });
};
