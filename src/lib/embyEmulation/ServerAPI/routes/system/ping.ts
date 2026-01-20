import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.get('/system/ping', async (req: Request, res: Response) => {
        res.send();
    });

    server.post('/system/ping', async (req: Request, res: Response) => {
        res.send();
    });
};
