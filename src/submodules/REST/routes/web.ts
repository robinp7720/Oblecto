import express, { Express, Request, Response } from 'express';
import path from 'path';
import { findPackageRoot } from '../../../lib/packageRoot.js';

export default (server: Express): void => {
    const root = findPackageRoot();
    const webDir = path.join(root, 'Oblecto-Web/dist/web');
    const logo = path.join(root, 'images/logomark.png');

    server.use('/web', express.static(webDir));

    server.get('/web/logo.png', (req: Request, res: Response) => {
        res.sendFile(logo, error => {
            if (error && !res.headersSent) res.status(404).send('Not Found');
        });
    });

    server.use('/web/*route', (req: Request, res: Response) => {
        res.sendFile(path.join(webDir, 'index.html'), error => {
            if (error && !res.headersSent) res.status(404).send('The web interface has not been built.');
        });
    });

    server.get('/', (req: Request, res: Response) => {
        res.redirect('/web/');
    });
};
