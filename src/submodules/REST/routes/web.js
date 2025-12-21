import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const webDir = path.join(process.cwd(), 'Oblecto-Web/dist/web/');

export default (server, oblecto) => {
    server.use('/web', express.static(webDir));

    server.get('/web/logo.png', (req, res) => {
        try {
            const logoPath = path.join(process.cwd(), 'images/logomark.png');
            res.sendFile(logoPath);
        } catch (error) {
            res.status(500).send('Error serving logo image');
        }
    });

    server.use('/web/*route', (req, res) => {
        res.sendFile(path.join(webDir, 'index.html'));
    });

    server.get('/', async (req, res) => {
        //res.redirect('/web', (v) => v);
    });
};