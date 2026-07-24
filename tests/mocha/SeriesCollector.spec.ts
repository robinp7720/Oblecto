import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import SeriesCollector from '../../src/lib/indexers/series/SeriesCollector.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

describe('SeriesCollector', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oblecto-series-collector-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const makeOblecto = (queuedJobs: Array<{ id: string; attr: any }>, directories: string[] = []) => ({
        config: {
            fileExtensions: { video: ['mkv', 'mp4'] },
            tvshows: { directories: directories.map(p => ({ path: p })) }
        },
        queue: { queueJob: (id: string, attr: any) => queuedJobs.push({ id, attr }) }
    }) as unknown as Oblecto;

    it('queues an indexEpisode job for files with a video extension', () => {
        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new SeriesCollector(makeOblecto(queuedJobs));

        collector.collectFile('/media/episode.mkv');

        assert.deepEqual(queuedJobs, [{ id: 'indexEpisode', attr: { path: '/media/episode.mkv' } }]);
    });

    it('ignores files with a non-video extension', () => {
        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new SeriesCollector(makeOblecto(queuedJobs));

        collector.collectFile('/media/thumbnail.jpg');

        assert.deepEqual(queuedJobs, []);
    });

    it('collectDirectory recursively queues every video file found', async () => {
        fs.writeFileSync(path.join(tmpDir, 'ep1.mkv'), '');
        fs.mkdirSync(path.join(tmpDir, 'season1'));
        fs.writeFileSync(path.join(tmpDir, 'season1', 'ep2.mp4'), '');
        fs.writeFileSync(path.join(tmpDir, 'nfo.txt'), '');

        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new SeriesCollector(makeOblecto(queuedJobs));

        await collector.collectDirectory(tmpDir);

        assert.equal(queuedJobs.length, 2);
    });

    it('collectAll processes every configured tvshows directory', async () => {
        fs.writeFileSync(path.join(tmpDir, 'a.mkv'), '');

        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new SeriesCollector(makeOblecto(queuedJobs, [tmpDir]));

        collector.collectAll();

        await new Promise((resolve) => setTimeout(resolve, 100));

        assert.equal(queuedJobs.length, 1);
    });
});
