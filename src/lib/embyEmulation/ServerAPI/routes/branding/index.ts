import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    server.get('/branding/configuration', (_req: Request, res: Response) => {
        res.send({
            LoginDisclaimer: 'This is an Oblecto Media server',
            CustomCss: ''
        });
    });

    server.get('/branding/css', (_req: Request, res: Response) => {
        res.send();
    });

    server.get('/branding/splashscreen', (_req: Request, res: Response) => {
        res.send('');
    });
    server.get('/branding/css.css', (_req: Request, res: Response) => {
        res.send('');
    });
};
