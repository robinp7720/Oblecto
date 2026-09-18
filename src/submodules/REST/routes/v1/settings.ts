/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import { ConfigManager } from '../../../../config.js';

import { allowedSections as ALLOWED_SECTIONS, mergeSettings, validateSettings } from '../../../../lib/settings/validation.js';
import { providers, testProvider } from '../../../../lib/settings/providerTest.js';

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
    server.get('/api/v1/settings', authMiddleWare.requiresPermission('settings.manage'), (req: Request, res: Response) => {
        res.send(scrubConfig(oblecto.config));
    });

    server.post('/api/v1/settings/providers/:provider/test', authMiddleWare.requiresPermission('settings.manage'), async (req: Request, res: Response) => {
        const provider = req.params.provider as typeof providers[number];
        if (!providers.includes(provider)) return res.status(400).send({ error: 'Unknown provider' });
        res.send(await testProvider(provider, oblecto.config[provider]?.key || ''));
    });

    server.patch('/api/v1/settings', authMiddleWare.requiresPermission('settings.manage'), async (req: Request, res: Response) => {
        const fields = validateSettings(req.body);
        if (Object.keys(fields).length) return res.status(400).send({ error: 'Check the highlighted settings.', fields });
        await ConfigManager.updateConfig(draft => mergeSettings(draft, req.body), oblecto.config);
        res.send(scrubConfig(oblecto.config));
    });

    // GET /api/v1/settings/:section
    server.get('/api/v1/settings/:section', authMiddleWare.requiresPermission('settings.manage'), (req: Request, res: Response, next: NextFunction) => {
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

    server.patch('/api/v1/settings/:section', authMiddleWare.requiresPermission('settings.manage'), async (req: Request, res: Response) => {
        const section = req.params.section as string;
        const updates = { [section]: req.body };
        const fields = validateSettings(updates);
        if (Object.keys(fields).length) return res.status(400).send({ error: 'Check the highlighted settings.', fields });
        await ConfigManager.updateConfig(draft => mergeSettings(draft, updates), oblecto.config);
        res.send(scrubConfig(oblecto.config)[section]);
    });
};
