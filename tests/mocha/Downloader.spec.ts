/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars */
import { promises as fs } from 'fs';
import expect from 'expect.js';

import Downloader from '../../src/lib/downloader/index.js';
import Queue from '../../src/lib/queue/index.js';

const oblecto = { queue: new Queue(1) };

describe('Downloader', function () {
    it('should execute a registered download job', async function () {
        const originalDownload = Downloader.download;
        const downloaded = Promise.withResolvers<[string, string, boolean | undefined]>();

        Downloader.download = async (url, dest, overwrite) => { downloaded.resolve([url, dest, overwrite]); };
        try {
            new Downloader(oblecto);
            oblecto.queue.queueJob('downloadFile', { url: 'https://example.test/artwork', dest: '/unused', overwrite: true });
            expect(await downloaded.promise).to.eql(['https://example.test/artwork', '/unused', true]);
        } finally {
            Downloader.download = originalDownload;
        }
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
