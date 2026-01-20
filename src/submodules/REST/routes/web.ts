/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import express, { Express, Request, Response } from 'express';
import path from 'path';

const webDir = path.join(process.cwd(), 'Oblecto-Web/dist/web/');

export default (server: Express, oblecto: any) => {
    server.use('/web', express.static(webDir));

    server.get('/web/logo.png', (req: Request, res: Response) => {
        try {
            const logoPath = path.join(process.cwd(), 'images/logomark.png');

            res.sendFile(logoPath);
        } catch (error) {
            res.status(500).send('Error serving logo image');
        }
    });

    server.use('/web/*route', (req: Request, res: Response) => {
        res.sendFile(path.join(webDir, 'index.html'));
    });

    server.get('/', async (req: Request, res: Response) => {
        // res.redirect('/web', (v) => v);
    });
};
