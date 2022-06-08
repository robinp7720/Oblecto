import restify from 'restify';
import { promises as fs } from 'fs';

/**
 * @param {Server} server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
    server.get('/web/static/*', restify.plugins.serveStatic({ directory: __dirname + '/../../../../Oblecto-Web/dist/', }));

    server.get('/web/logo.png', async (req, res) => {
        const body = await fs.readFile(__dirname + '/../../../../images/logomark.png');

        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(body),
            'Content-Type': 'image/png'
        });

        res.write(body);
        res.end();
    });

    server.get('/web*', async (req, res) => {
        let body = await fs.readFile(__dirname + '/../../../../Oblecto-Web/dist/web/index.html', 'utf8');

        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(body),
            'Content-Type': 'text/html'
        });

        res.write(body);
        res.end();
    });

    server.get('/', async (req, res) => {
        res.redirect('/web');
    });
};
