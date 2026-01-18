import { promises as fs } from 'fs';
import expect from 'expect.js';

import Downloader from '../../src/lib/downloader/index.js';
import Queue from '../../src/lib/queue/index.js';

const oblecto = { queue: new Queue(1) };

describe('Downloader', function () {
    it('should register queue item', function () {
        const downloader = new Downloader(oblecto);

        expect(oblecto.queue.jobs).to.have.property('downloadFile');
    });

    it('Download test file', async function () {
        const path = '/tmp/oblectoTestDownload';

        await fs.rm(path, { force: true });
        return Downloader.download('https://github.com', path, true);
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
        return Downloader.attemptDownload(['https://example.invalid','https://github.com'], path);
    });
});
