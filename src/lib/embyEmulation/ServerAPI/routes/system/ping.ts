import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    server.get('/system/ping', (req: Request, res: Response) => {
        res.send();
    });

    server.post('/system/ping', (req: Request, res: Response) => {
        res.send();
    });
};
