import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { brandingConfiguration } from '../../serverConfiguration.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    // What the sign-in page shows and the web client's extra CSS, from jellyfin.loginDisclaimer and
    // jellyfin.customCss. Public: the sign-in page loads them before anyone is signed in.
    server.get('/branding/configuration', (_req: Request, res: Response) => {
        res.send(brandingConfiguration(embyEmulation));
    });

    const css = (_req: Request, res: Response): void => {
        res.type('text/css').send(embyEmulation.oblecto.config.jellyfin.customCss ?? '');
    };

    server.get('/branding/css', css);
    server.get('/branding/css.css', css);

    server.get('/branding/splashscreen', (_req: Request, res: Response) => {
        res.status(404).send('Not Found');
    });
};
