import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Plugins
    server.get('/plugins', (_req: Request, res: Response) => { res.send([]); });
    server.get('/plugins/:pluginid/configuration', (_req: Request, res: Response) => { res.send({}); });
    server.get('/plugins/:pluginid/manifest', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/plugins/:pluginid/:version', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.post('/plugins/:pluginid/:version/disable', (_req: Request, res: Response) => { res.status(204).send(); });
    server.post('/plugins/:pluginid/:version/enable', (_req: Request, res: Response) => { res.status(204).send(); });
    server.get('/plugins/:pluginid/:version/image', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Packages
    server.get('/packages', (_req: Request, res: Response) => { res.send([]); });
    server.get('/packages/:name', (_req: Request, res: Response) => { res.send([]); });
    server.get('/packages/installed/:name', (_req: Request, res: Response) => { res.send([]); });
    server.post('/packages/installing/:packageid', (_req: Request, res: Response) => { res.status(204).send(); });

    // Repositories
    server.get('/repositories', (_req: Request, res: Response) => { res.send([]); });
    server.post('/repositories', (_req: Request, res: Response) => { res.status(204).send(); }); // Guessing post exists for adding
};
