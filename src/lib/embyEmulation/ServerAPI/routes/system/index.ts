import ping from './ping';
import info from './info';

import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import type { EmbyRequest } from '../../index.js';
import { embyUserCan } from '../../permission.js';
import { brandingConfiguration, ConfigurationError, encodingConfiguration, fromBrandingConfiguration, fromEncodingConfiguration, fromSystemConfiguration, saveConfiguration, systemConfiguration } from '../../serverConfiguration.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    ping(server, embyEmulation);
    info(server, embyEmulation);

    server.get('/system/endpoint', (_req: Request, res: Response) => {
        res.send({
            IsLocal: true,
            IsInNetwork: true
        });
    });

    // Oblecto keeps no activity log of its own to show here.
    server.get('/System/ActivityLog/Entries', (_req: Request, res: Response) => {
        res.send({
            Items: [],
            TotalRecordCount: 0,
            StartIndex: 0
        });
    });

    server.get('/system/configuration', (_req: Request, res: Response) => {
        res.send(systemConfiguration(embyEmulation));
    });

    // An administrator saving the dashboard's settings: what Oblecto keeps is saved, the rest ignored
    const save = (read: (body: Record<string, unknown>) => Record<string, Record<string, unknown>>) => async (req: EmbyRequest, res: Response): Promise<void> => {
        if (!await embyUserCan(req, 'settings.manage')) {
            res.status(403).send('Forbidden');
            return;
        }

        const body = req.body as unknown;

        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
            res.status(400).send('Expected settings');
            return;
        }

        try {
            await saveConfiguration(embyEmulation, read(body as Record<string, unknown>));
            res.status(204).send();
        } catch (error) {
            if (!(error instanceof ConfigurationError)) throw error;
            res.status(error.statusCode).send(error.message);
        }
    };

    server.post('/system/configuration', save(fromSystemConfiguration));
    server.post('/system/configuration/encoding', save(fromEncodingConfiguration));
    server.post('/system/configuration/branding', save(fromBrandingConfiguration));

    server.get('/system/configuration/metadata', (_req: Request, res: Response) => {
        res.send({
            EnableLocalMetadata: true,
            EnableEmbeddedTitles: true,
            EnableEmbeddedOverview: true,
            EnableEmbeddedRatings: true,
            EnableImageExtraction: true,
            UseFileCreationTimeForDateAdded: false,
            PeopleLimit: 0,
            MetadataOptions: []
        });
    });

    server.get('/system/configuration/xbmcmetadata', (_req: Request, res: Response) => {
        res.send({
            EnablePathSubstitution: false,
            EnableEpisodeTitleString: false,
            EnableSeriesInfo: true
        });
    });

    server.get('/system/configuration/encoding', (_req: Request, res: Response) => {
        res.send(encodingConfiguration(embyEmulation));
    });

    server.get('/system/configuration/branding', (_req: Request, res: Response) => {
        res.send(brandingConfiguration(embyEmulation));
    });

    server.get('/system/configuration/metadataoptions/default', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/system/logs', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/system/logs/log', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/system/restart', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/system/shutdown', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    // Registered after the named sections above, which answer themselves; Oblecto has no others
    server.get('/system/configuration/:key', (_req: Request, res: Response) => {
        res.status(404).send('Not Found');
    });

    // TODO: Implement Backup routes
    server.get('/backup', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/backup/create', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/backup/manifest', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/backup/restore', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    // TODO: Implement ClientLog routes
    server.post('/clientlog/document', (_req: Request, res: Response) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

};
