import express from 'express';
import path from 'path';
/**
 * @typedef {import('express').Express} Server
 * @typedef {import('../../../lib/oblecto').default} Oblecto
 */


const webDir = path.join(__dirname, '../../../../Oblecto-Web/dist/web/');

/**
 * @param {Server} server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
    server.use('/web', express.static(webDir));

    server.get('/web/logo.png', (req, res) => {
        try {
            const logoPath = path.join(__dirname, '../../../../images/logomark.png');
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
