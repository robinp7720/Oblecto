import assert from 'node:assert/strict';
import { mock, type Mock } from 'node:test';
import { Client } from 'basic-ftp';
import SeedboxImportFTPS from '../../src/lib/seedbox/SeedboxImportDrivers/SeedboxImportFTPS.js';

describe('SeedboxImportFTPS', function () {
    let driver: SeedboxImportFTPS;
    let access: Mock<Client['access']>;
    let download: Mock<Client['downloadTo']>;
    let close: Mock<Client['close']>;
    const response = { code: 200, message: 'OK' };

    beforeEach(function () {
        driver = new SeedboxImportFTPS({
            host: 'seedbox.example', port: 2121, username: 'test', password: 'test', secure: true
        });
        access = mock.method(Client.prototype, 'access', async () => response);
        download = mock.method(Client.prototype, 'downloadTo', async () => response);
        close = mock.method(Client.prototype, 'close');
    });

    afterEach(function () {
        driver.client.close();
        mock.restoreAll();
    });

    it('uses the same connection settings, including the port, for listing and transfers', async function () {
        await driver.setup();
        await driver.copy('/remote/movie.mkv', '/local/movie.mkv');

        assert.equal(access.mock.callCount(), 2);
        for (const call of access.mock.calls) {
            assert.deepEqual(call.arguments[0], {
                host: 'seedbox.example', port: 2121, user: 'test', password: 'test', secure: true
            });
        }
    });

    it('closes the transfer connection after success and keeps the listing connection separate', async function () {
        await driver.copy('/remote/movie.mkv', '/local/movie.mkv');

        assert.deepEqual(download.mock.calls[0].arguments, ['/local/movie.mkv', '/remote/movie.mkv']);
        assert.equal(close.mock.callCount(), 1);
        assert.equal(close.mock.calls[0].this, download.mock.calls[0].this);
        assert.notEqual(close.mock.calls[0].this, driver.client);
    });

    for (const stage of ['access', 'downloadTo'] as const) {
        it(`closes the transfer connection and propagates ${stage} failures`, async function () {
            const error = new Error(`${stage} failed`);
            mock.method(Client.prototype, stage, async () => { throw error; });

            await assert.rejects(driver.copy('/remote/movie.mkv', '/local/movie.mkv'), error);
            assert.equal(close.mock.callCount(), 1);
            assert.notEqual(close.mock.calls[0].this, driver.client);
        });
    }

    for (const sizeAvailable of [true, false]) {
        it(`reports progress when the remote file size is ${sizeAvailable ? 'available' : 'unavailable'}`, async function () {
            mock.method(Client.prototype, 'size', async () => {
                if (!sizeAvailable) throw new Error('SIZE unsupported');
                return 100;
            });
            mock.method(Client.prototype, 'trackProgress', handler => {
                handler?.({ name: 'movie.mkv', type: 'download', bytes: 50, bytesOverall: 50 });
            });
            const progress: number[][] = [];

            await driver.copy('/remote/movie.mkv', '/local/movie.mkv', (transferred, total) => {
                progress.push([transferred, total]);
            });

            assert.deepEqual(progress, [[50, sizeAvailable ? 100 : 0]]);
            assert.equal(close.mock.callCount(), 1);
        });
    }
});
