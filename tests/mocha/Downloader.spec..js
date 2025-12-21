import expect from 'expect.js';

import Downloader from '../../src/lib/downloader/index.js';
import Queue from '../../src/lib/queue/index.js';

const oblecto = { queue: new Queue(1) };

describe('Downloader', function () {
    it('should register queue item', function () {
        const downloader = new Downloader(oblecto);

        expect(oblecto.queue.jobs).to.have.property('downloadFile');
    });

    it('Download test file', function () {
        return Downloader.download('https://github.com', '/tmp/oblectoTest', true);
    });

    // TODO: FIX TEST
    /* it('Overwriting file should fail', function (done) {
        return Downloader.download('https://github.com', '/tmp/oblectoTest', false)
            .then(() => done(new Error()))
            .catch(() => done());
    });*/

    it('Download first successful from array', function () {
        return Downloader.attemptDownload(['https://exapmle.com','https://github.com'], '/tmp/oblectoTest', true);
    });
});
