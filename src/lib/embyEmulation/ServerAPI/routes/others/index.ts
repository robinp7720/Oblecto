import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Environment
    server.get('/environment/defaultdirectorybrowser', (_req: Request, res: Response) => { res.send({}); });
    server.get('/environment/directorycontents', (_req: Request, res: Response) => { res.send([]); });
    server.get('/environment/drives', (_req: Request, res: Response) => { res.send([]); });
    server.get('/environment/networkshares', (_req: Request, res: Response) => { res.send([]); });
    server.get('/environment/parentpath', (_req: Request, res: Response) => { res.send(''); });
    server.post('/environment/validatepath', (_req: Request, res: Response) => { res.status(204).send(); });

    // ScheduledTasks
    server.get('/scheduledtasks/:taskid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/scheduledtasks/:taskid/triggers', (_req: Request, res: Response) => { res.send([]); });
    server.post('/scheduledtasks/running/:taskid', (_req: Request, res: Response) => { res.status(204).send(); });
    // Note: /scheduledtasks is already in main index.js, need to check if it conflicts or I should remove it there.
    // The main index.js has: server.get('/scheduledtasks', async (req, res) => { res.send({}); });

    // Startup
    server.get('/startup/complete', (_req: Request, res: Response) => { res.status(204).send(); });
    server.get('/startup/configuration', (_req: Request, res: Response) => { res.send({}); });
    server.get('/startup/firstuser', (_req: Request, res: Response) => { res.send({}); });
    server.get('/startup/remoteaccess', (_req: Request, res: Response) => { res.send({}); });
    server.get('/startup/user', (_req: Request, res: Response) => { res.send({}); });

    // FallbackFont
    server.get('/fallbackfont/fonts', (_req: Request, res: Response) => { res.send([]); });
    server.get('/fallbackfont/fonts/:name', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // GetUtcTime
    server.get('/getutctime', (_req: Request, res: Response) => { res.send(new Date().toISOString()); });

    // Tmdb
    server.get('/tmdb/clientconfiguration', (_req: Request, res: Response) => { res.send({}); });
};
