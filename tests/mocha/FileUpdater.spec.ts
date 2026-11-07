import { Sequelize } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import Queue from '../../src/lib/queue/index.js';
import { File, fileColumns } from '../../src/models/file.js';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import assert from 'node:assert/strict';
import FileUpdater from '../../src/lib/updaters/files/FileUpdater.js';

describe('FileUpdater', function () {

    class RecordingQueue extends Queue {
        queued: Array<{ name: string; data: unknown }> = [];
        override queueJob(...[name, data]: Parameters<Queue['queueJob']>): void { this.queued.push({ name, data }); }
    }
    let database: Sequelize;
    before(() => {
        database = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        File.init(fileColumns, { sequelize: database, modelName: 'File' });
    });
    after(async () => { await database.close(); });

    for (const streamCount of [0, 2]) {
        it(`queues stream indexing only for missing streams (count ${streamCount})`, async () => {
            const queue = new RecordingQueue(1);
            const updater = new FileUpdater({ queue, config: { files: { doHash: false } } });
            const file = File.build({ id: 1, path: '/fixture.mkv', duration: 100, size: 1000, extension: 'mkv', hash: 'hash' });
            file.countStreams = () => Promise.resolve(streamCount);
            await updater.updateFile(file);
            const indexed = queue.queued.find(job => job.name === 'indexFileStreams');
            if (streamCount === 0) { assert.ok(indexed); assert.equal(indexed.data, file); }
            else assert.equal(indexed, undefined);
            await queue.close();
        });
    }

    it('compares FFprobe numeric-string durations numerically for both stream types', async () => {
        for (const codec_type of ['video', 'audio']) {
            const streams = [{ codec_type, index: 0, duration: '9.0' }, { codec_type, index: 1, duration: '100.0' }];
            const select = codec_type === 'video' ? FileUpdater.getPrimaryVideoStream : FileUpdater.getPrimaryAudioStream;
            assert.equal((await select({ streams }))?.index, 1);
        }
    });

    describe('getPrimaryVideoStream', function() {
        it('should return null if no streams', async function() {
            const result = await FileUpdater.getPrimaryVideoStream({ streams: [] });
            assert.equal(result, null);
        });

        it('should return null if no video streams', async function() {
            const result = await FileUpdater.getPrimaryVideoStream({streams: [{ codec_type: 'audio', index: 0 }]});
            assert.equal(result, null);
        });

        it('should return the video stream with longest duration', async function() {
            const streams = [
                { codec_type: 'video', index: 0, duration: 100},
                { codec_type: 'video', index: 1, duration: 200}, // Winner
                { codec_type: 'audio', index: 2, duration: 500}
            ];
            const result = await FileUpdater.getPrimaryVideoStream({ streams });
            assert.ok(result);
            assert.equal(result.index, 1);
        });

        it('should handle missing duration by assuming 0', async function() {
             const streams = [
                { codec_type: 'video', index: 0 }, // undefined duration -> 0
                { codec_type: 'video', index: 1, duration: 10}
            ];
            const result = await FileUpdater.getPrimaryVideoStream({ streams });
            assert.ok(result);
            assert.equal(result.index, 1);
        });
    });

    describe('getPrimaryAudioStream', function() {
        it('should return null if no streams', async function() {
            const result = await FileUpdater.getPrimaryAudioStream({ streams: [] });
            assert.equal(result, null);
        });

        it('should return null if no audio streams', async function() {
            const result = await FileUpdater.getPrimaryAudioStream({streams: [{ codec_type: 'video', index: 0 }]});
            assert.equal(result, null);
        });

        it('should return the audio stream with longest duration', async function() {
            const streams = [
                { codec_type: 'audio', index: 0, duration: 100},
                { codec_type: 'audio', index: 1, duration: 200}, // Winner
                { codec_type: 'video', index: 2, duration: 500}
            ];
            const result = await FileUpdater.getPrimaryAudioStream({ streams });
            assert.ok(result);
            assert.equal(result.index, 1);
        });
    });
});
