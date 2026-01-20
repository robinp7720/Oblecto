/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

/**
 * @param server - The Express application
 * @param embyEmulation - The EmbyEmulation instance
 */
export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.get('/quickconnect/enabled', (_req: Request, res: Response) => {
        res.send(false);
    });

    server.post('/quickconnect/enabled', (req: Request, res: Response) => {
        const token = req.headers?.emby ? (req.headers.emby as any).Token : undefined;
        if (token && embyEmulation.sessions[token]) {
            embyEmulation.sessions[token].capabilities = req.query;
        }

        res.send(false);
    });

    server.get('/quickconnect/initiate', (_req: Request, res: Response) => { res.status(501).send('Not Implemented'); });
    server.get('/quickconnect/connect', (_req: Request, res: Response) => { res.status(501).send('Not Implemented'); });
    server.post('/quickconnect/authorize', (_req: Request, res: Response) => { res.status(501).send('Not Implemented'); });
};
