/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import { ConfigManager } from '../../../../config.js';

const ALLOWED_SECTIONS = [
    'indexer', 'cleaner', 'mdns', 'queue', 'tvdb', 'themoviedb', 
    'fanart.tv', 'assets', 'server', 'files', 'artwork', 
    'fileExtensions', 'tracker', 'transcoding', 'web', 'streaming', 
    'authentication', 'federation', 'seedboxes', 'movies', 'tvshows'
];

// Simple secret scrubber
const scrubConfig = (conf: any) => {
    const copy = JSON.parse(JSON.stringify(conf));

    if (copy.authentication?.secret) copy.authentication.secret = '***';
    if (copy.federation?.key) copy.federation.key = '***';
    if (copy.seedboxes) {
        copy.seedboxes.forEach((sb: any) => {
            if (sb.storageDriverOptions?.password) {
                sb.storageDriverOptions.password = '***';
            }
        });
    }
    return copy;
};

export default (server: Express, oblecto: any) => {
    
    // GET /api/v1/settings - Get full config
    server.get('/api/v1/settings', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        res.send(scrubConfig(oblecto.config));
    });

    // PATCH /api/v1/settings - Update multiple sections
    server.patch('/api/v1/settings', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        // Validate sections
        for (const section of Object.keys(updates)) {
            if (!ALLOWED_SECTIONS.includes(section)) {
                return next(new errors.BadRequestError(`Invalid setting section: ${section}`));
            }
        }

        // Apply updates
        for (const [key, value] of Object.entries(updates)) {
            // Shallow merge for top-level sections
            if (typeof oblecto.config[key as keyof any] === 'object' && !Array.isArray(oblecto.config[key as keyof any]) && oblecto.config[key as keyof any] !== null) {
                Object.assign(oblecto.config[key as keyof any], value);
            } else {
                oblecto.config[key as keyof any] = value as any;
            }
        }

        ConfigManager.saveConfig();
        res.send(scrubConfig(oblecto.config));
    });

    // GET /api/v1/settings/:section
    server.get('/api/v1/settings/:section', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const section = req.params.section as string;

        if (!ALLOWED_SECTIONS.includes(section)) {
            return next(new errors.BadRequestError('Invalid setting section'));
        }
        const sectionData = oblecto.config[section as keyof any];

        if (!sectionData) return next(new errors.NotFoundError('Section not found'));

        let dataToSend = sectionData;

        if (section === 'authentication') {
            dataToSend = { ...sectionData, secret: '***' };
        } else if (section === 'federation') {
            dataToSend = { ...sectionData, key: '***' };
        }

        res.send(dataToSend);
    });

    // PATCH /api/v1/settings/:section
    server.patch('/api/v1/settings/:section', authMiddleWare.requiresAuth, (req: Request, res: Response, next: NextFunction) => {
        const section = req.params.section as string;

        if (!ALLOWED_SECTIONS.includes(section)) {
            return next(new errors.BadRequestError('Invalid setting section'));
        }

        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        if (!oblecto.config[section as keyof any]) oblecto.config[section as keyof any] = {} as any;

        const currentSection = oblecto.config[section as keyof any];

        if (typeof currentSection === 'object' && !Array.isArray(currentSection)) {
            Object.assign(currentSection, updates);
        } else {
            oblecto.config[section as keyof any] = updates;
        }

        ConfigManager.saveConfig();
        res.send(oblecto.config[section as keyof any]);
    });
};
