/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/unbound-method, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
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
    server.patch('/api/v1/libraries/:type', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }
        
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        Object.assign(oblecto.config[type as keyof any], updates);
        ConfigManager.saveConfig();

        res.send(oblecto.config[type as keyof any]);
    });

    // POST /api/v1/libraries/:type/paths - Add a source directory
    server.post('/api/v1/libraries/:type/paths', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body;

        if (!path) {
            return next(new errors.BadRequestError('Path is required'));
        }

        const libConfig = oblecto.config[type as keyof any];

        if (!libConfig.directories) libConfig.directories = [];

        // Check for duplicates
        if (libConfig.directories.some((d: any) => d.path === path)) {
            return next(new errors.ConflictError('Path already exists'));
        }

        libConfig.directories.push({ path });
        ConfigManager.saveConfig();

        res.send(libConfig.directories);
    });

    // DELETE /api/v1/libraries/:type/paths - Remove a source directory
    server.delete('/api/v1/libraries/:type/paths', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const type = req.params.type as string;

        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body;

        if (!path) {
            return next(new errors.BadRequestError('Path is required'));
        }

        const libConfig = oblecto.config[type as keyof any];
        const index = libConfig.directories.findIndex((d: any) => d.path === path);

        if (index === -1) {
            return next(new errors.NotFoundError('Path not found'));
        }

        libConfig.directories.splice(index, 1);
        ConfigManager.saveConfig();

        res.send(libConfig.directories);
    });
};
