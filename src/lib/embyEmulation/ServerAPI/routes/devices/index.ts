import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    server.get('/devices', (_req: Request, res: Response) => {
        res.send({
            Items: [],
            TotalRecordCount: 0,
            StartIndex: 0
        });
    });

    server.get('/devices/info', (_req: Request, res: Response) => { res.send({}); });
    server.get('/devices/options', (_req: Request, res: Response) => { res.send({}); });
};
