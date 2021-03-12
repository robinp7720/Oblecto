'strict';

const expect = require('expect.js');

const { default: Downloader } = require('../../dist/lib/downloader');
const { default: Queue } = require('../../dist/lib/queue');

const oblecto = {
    queue: new Queue(1)
};

describe('Downloader', function () {
    it('should register queue item', function () {
        const downloader = new Downloader(oblecto);
        expect(oblecto.queue.jobs).to.have.property('downloadFile');
    });

    it('Download test file', function () {
        return Downloader.download('https://github.com', '/tmp/oblectoTest', true);
    });

    it('Overwriting file should fail', function (done) {
        return Downloader.download('https://github.com', '/tmp/oblectoTest', false)
            .then(() => done(new Error()))
            .catch(() => done());
    });

    it('Download first successful from array', function () {
        return Downloader.attemptDownload(['https://exapmle.com','https://github.com'], '/tmp/oblectoTest', true);
    });
});
