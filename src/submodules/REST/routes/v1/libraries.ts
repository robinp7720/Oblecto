/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import { mergeSettings, validateSettings } from '../../../../lib/settings/validation.js';
import { ConfigManager } from '../../../../config.js';

const ALLOWED_LIBRARIES = ['movies', 'tvshows'];

export default (server: Express, oblecto: any) => {
    
    // GET /api/v1/libraries
    server.get('/api/v1/libraries', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        const libs: any = {};

        ALLOWED_LIBRARIES.forEach(lib => {
            libs[lib] = oblecto.config[lib as keyof any];
        });
        res.send(libs);
    });

    // GET /api/v1/libraries/:type
    server.get('/api/v1/libraries/:type', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }
        res.send(oblecto.config[type as keyof any].directories || []);
    });

    // PATCH /api/v1/libraries/:type - Update general library settings (identifiers, updaters, etc)
    server.patch('/api/v1/libraries/:type', authMiddleWare.requiresPermission('libraries.manage'), async (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }
        
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        const fields = validateSettings({ [type]: updates }, oblecto.config);
        if (Object.keys(fields).length) return res.status(400).send({ error: 'Check library settings.', fields });
        await ConfigManager.updateConfig(draft => mergeSettings(draft, { [type]: updates }), oblecto.config);

        res.send(oblecto.config[type as keyof any]);
    });

    // POST /api/v1/libraries/:type/paths - Add a source directory
    server.post('/api/v1/libraries/:type/paths', authMiddleWare.requiresPermission('libraries.manage'), async (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body || {};

        if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
            return next(new errors.BadRequestError('Path is required'));
        }

        await ConfigManager.updateConfig(draft => {
            const library = draft[type as 'movies' | 'tvshows'];
            library.directories ??= [];
            if (library.directories.some(d => d.path === path)) throw new errors.ConflictError('Path already exists');
            library.directories.push({ path });
        }, oblecto.config);
        res.send(oblecto.config[type].directories);
    });

    // DELETE /api/v1/libraries/:type/paths - Remove a source directory
    server.delete('/api/v1/libraries/:type/paths', authMiddleWare.requiresPermission('libraries.manage'), async (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body || {};

        if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
            return next(new errors.BadRequestError('Path is required'));
        }

        await ConfigManager.updateConfig(draft => {
            const library = draft[type as 'movies' | 'tvshows'];
            library.directories ??= [];
            const index = library.directories.findIndex(d => d.path === path);
            if (index === -1) throw new errors.NotFoundError('Path not found');
            library.directories.splice(index, 1);
        }, oblecto.config);
        res.send(oblecto.config[type].directories);
    });
};
