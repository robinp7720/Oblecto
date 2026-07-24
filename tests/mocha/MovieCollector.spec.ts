import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import MovieCollector from '../../src/lib/indexers/movies/MovieCollector.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

describe('MovieCollector', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oblecto-movie-collector-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const makeOblecto = (queuedJobs: Array<{ id: string; attr: any }>, directories: string[] = []) => ({
        config: {
            fileExtensions: { video: ['mkv', 'mp4'] },
            movies: { directories: directories.map(p => ({ path: p })) }
        },
        queue: { queueJob: (id: string, attr: any) => queuedJobs.push({ id, attr }) }
    }) as unknown as Oblecto;

    it('queues an indexMovie job for files with a video extension', () => {
        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new MovieCollector(makeOblecto(queuedJobs));

        collector.collectFile('/media/movie.mkv');

        assert.deepEqual(queuedJobs, [{ id: 'indexMovie', attr: { path: '/media/movie.mkv' } }]);
    });

    it('ignores files with a non-video extension', () => {
        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new MovieCollector(makeOblecto(queuedJobs));

        collector.collectFile('/media/poster.jpg');

        assert.deepEqual(queuedJobs, []);
    });

    it('extension matching is case-insensitive', () => {
        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new MovieCollector(makeOblecto(queuedJobs));

        collector.collectFile('/media/movie.MKV');

        assert.equal(queuedJobs.length, 1);
    });

    it('collectDirectory recursively queues every video file found', async () => {
        fs.writeFileSync(path.join(tmpDir, 'movie1.mkv'), '');
        fs.mkdirSync(path.join(tmpDir, 'sub'));
        fs.writeFileSync(path.join(tmpDir, 'sub', 'movie2.mp4'), '');
        fs.writeFileSync(path.join(tmpDir, 'readme.txt'), '');

        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new MovieCollector(makeOblecto(queuedJobs));

        await collector.collectDirectory(tmpDir);

        assert.equal(queuedJobs.length, 2);
        const paths = queuedJobs.map(j => j.attr.path).sort();
        assert.ok(paths[0].endsWith('movie1.mkv'));
        assert.ok(paths[1].endsWith('movie2.mp4'));
    });

    it('collectAll processes every configured movie directory', async () => {
        fs.writeFileSync(path.join(tmpDir, 'a.mkv'), '');

        const queuedJobs: Array<{ id: string; attr: any }> = [];
        const collector = new MovieCollector(makeOblecto(queuedJobs, [tmpDir]));

        collector.collectAll();

        await new Promise((resolve) => setTimeout(resolve, 100));

        assert.equal(queuedJobs.length, 1);
    });
});
