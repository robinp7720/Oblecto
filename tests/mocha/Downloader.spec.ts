/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars */
import { promises as fs } from 'fs';
import http from 'node:http';
import expect from 'expect.js';

import Downloader from '../../src/lib/downloader/index.js';
import Queue from '../../src/lib/queue/index.js';

const oblecto = { queue: new Queue(1) };

describe('Downloader', function () {
    let server: http.Server;
    let baseUrl: string;

    before(function (done) {
        // A local server instead of a live external host (the previous
        // version downloaded https://github.com) removes flakiness from
        // relying on outside network access/availability.
        server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('hello from test server');
        });
        server.listen(0, () => {
            const port = (server.address() as any).port;
            baseUrl = `http://127.0.0.1:${port}`;
            done();
        });
    });

    after(function (done) {
        server.close(() => done());
    });

    it('should register queue item', function () {
        const downloader = new Downloader(oblecto);

        expect(oblecto.queue.jobs).to.have.property('downloadFile');
    });

    it('Download test file', async function () {
        const path = '/tmp/oblectoTestDownload';

        await fs.rm(path, { force: true });
        await Downloader.download(baseUrl, path, true);

        expect(await fs.readFile(path, 'utf8')).to.be('hello from test server');
    });

    // TODO: FIX TEST
    /* it('Overwriting file should fail', function (done) {
        return Downloader.download('https://github.com', '/tmp/oblectoTest', false)
            .then(() => done(new Error()))
            .catch(() => done());
    });*/

    it('Download first successful from array', async function () {
        const path = '/tmp/oblectoTestAttempt';

        await fs.rm(path, { force: true });
        // example.invalid is an RFC 2606 reserved TLD guaranteed to never resolve.
        await Downloader.attemptDownload(['https://example.invalid', baseUrl], path);

        expect(await fs.readFile(path, 'utf8')).to.be('hello from test server');
    });
});
