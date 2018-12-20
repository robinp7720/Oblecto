import restify from 'restify';
import fs from 'fs';

export default (server) => {
    server.get('/web/static/*', restify.plugins.serveStatic({
        directory: __dirname + '/../../../../Oblecto-Web/dist/',
    }));

    server.get('/web*', async (req, res, next) => {
        fs.readFile(__dirname + '/../../../../Oblecto-Web/dist/web/index.html', 'utf8', function (err, body) {
            res.writeHead(200, {
                'Content-Length': Buffer.byteLength(body),
                'Content-Type': 'text/html'
            });

            res.write(body);
            res.end();
        });
    });
};