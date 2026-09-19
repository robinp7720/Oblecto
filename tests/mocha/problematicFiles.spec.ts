/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize';

import { Movie, movieColumns } from '../../src/models/movie.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';

import filesRoutes from '../../src/submodules/REST/routes/files.js';
import MovieIndexer from '../../src/lib/indexers/movies/MovieIndexer.js';
import SeriesIndexer from '../../src/lib/indexers/series/SeriesIndexer.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import { clearProblem, isInDirectory, markProblematic, retryProblem } from '../../src/lib/indexers/files/problems.js';
import logger from '../../src/submodules/logger/index.js';

const makeQueue = () => ({
    jobs: {} as Record<string, (attr: any) => Promise<void>>,
    queued: [] as Array<{ id: string; attr: any }>,
    registerJob(id: string, job: (attr: any) => Promise<void>) {
        this.jobs[id] = job;
    },
    queueJob(id: string, attr: any) {
        this.queued.push({ id, attr });
    },
    pushJob(id: string, attr: any) {
        this.queued.push({ id, attr });
    },
    lowPriorityJob(id: string, attr: any) {
        this.queued.push({ id, attr });
    }
});

const createOblecto = (): any => {
    const broadcasts: any[] = [];

    return {
        queue: makeQueue(),
        broadcasts,
        realTimeController: { broadcast: (event: string, payload: unknown) => broadcasts.push({ event, payload }) },
        fileIndexer: {},
        config: {
            movies: { directories: [{ path: '/media/Movies' }], movieIdentifiers: [] },
            tvshows: {
                directories: [{ path: '/media/TV' }],
                seriesIdentifiers: [],
                episodeIdentifiers: []
            }
        }
    };
};

const makeServer = () => {
    const handlers = new Map();
    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
    };

    return {
        handlers,
        get: register('GET'),
        post: register('POST'),
        put: register('PUT'),
        patch: register('PATCH'),
        delete: register('DELETE')
    };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) {
        this.statusCode = code;
        return this;
    },
    send(payload: any) {
        this.body = payload;
        return this;
    }
});

const call = async (server: ReturnType<typeof makeServer>, key: string, req: any) => {
    const res = makeRes();
    let error: Error | undefined;

    await server.handlers.get(key)(req, res, (e: Error) => { error = e; });

    if (error) throw error;

    return res;
};

/**
 * Models are shared by every spec in the run. `Model.init()` forgets earlier
 * associations but leaves their mixins on the prototype, and Sequelize never
 * replaces an existing mixin, so e.g. an earlier `Movie.hasMany(File)` would
 * keep providing `movie.addFile`. Strip the mixins this spec relies on.
 * @param models - Models to strip
 */
const stripAssociationMixins = (...models: Array<{ prototype: object }>) => {
    const mixin = /^(get|set|add|remove|has|count|create)(Files?|Movies?|Episodes?|Streams?|Series)$/;

    for (const model of models) {
        for (const name of Object.getOwnPropertyNames(model.prototype)) {
            if (mixin.test(name)) Reflect.deleteProperty(model.prototype, name);
        }
    }
};

describe('Problematic files', function () {
    let sequelize: Sequelize;
    const originalAccess = fs.access;

    before(async function () {
        logger.silent = true;

        // Every path in this spec exists on "disk" unless it says otherwise
        fs.access = (async (filePath: string) => {
            if (filePath.includes('missing')) throw new Error('ENOENT');
        }) as typeof fs.access;

        sequelize = new Sequelize({
            dialect: 'sqlite', dialectModule: nodeSqlite,
            storage: ':memory:',
            logging: false
        });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
        EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });

        stripAssociationMixins(Movie, Episode, Series, File, Stream);

        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });

        Episode.belongsToMany(File, { through: EpisodeFiles });
        File.belongsToMany(Episode, { through: EpisodeFiles });

        File.hasMany(Stream);
        Stream.belongsTo(File);

        Episode.belongsTo(Series);
        Series.hasMany(Episode);
    });

    after(async function () {
        fs.access = originalAccess;
        logger.silent = false;
        await sequelize.close();
    });

    beforeEach(async function () {
        await sequelize.sync({ force: true });
    });

    describe('isInDirectory', function () {
        it('matches files inside the directory', function () {
            assert.equal(isInDirectory('/media/Movies', '/media/Movies/Film (2001)/film.mkv'), true);
            assert.equal(isInDirectory('/media/Movies/', '/media/Movies/film.mkv'), true);
        });

        it('does not match sibling directories sharing a prefix', function () {
            assert.equal(isInDirectory('/media/Movies', '/media/Movies2/film.mkv'), false);
            assert.equal(isInDirectory('/media/Movies', '/media/Movies'), false);
            assert.equal(isInDirectory('/media/Movies', '/media/TV/show.mkv'), false);
        });
    });

    describe('markProblematic / clearProblem', function () {
        it('records the stage and broadcasts the change', async function () {
            const oblecto = createOblecto();
            const file = await File.create({ path: '/media/Movies/a.mkv' });

            await markProblematic(oblecto, file, 'probe', 'Invalid data');
            await file.reload();

            assert.equal(file.problematic, true);
            assert.equal(file.problemStage, 'probe');
            assert.equal(file.error, 'Invalid data');
            assert.deepEqual(oblecto.broadcasts[0], {
                event: 'indexer',
                payload: {
                    event: 'problem', fileId: file.id, problematic: true, problemStage: 'probe', error: 'Invalid data'
                }
            });
        });

        it('leaves the file\'s own path out of the error', async function () {
            const oblecto = createOblecto();
            const file = await File.create({ path: '/media/Movies/x.mkv' });

            await markProblematic(oblecto, file, 'identify', 'Could not identify: /media/Movies/x.mkv (TmdbMovie: no results)');
            assert.equal(file.error, 'Could not identify (TmdbMovie: no results)');

            await markProblematic(oblecto, file, 'identify', 'Could not identify: /media/Movies/x.mkv');
            assert.equal(file.error, 'Could not identify');

            await markProblematic(oblecto, file, 'probe', 'Invalid data found when processing input');
            assert.equal(file.error, 'Invalid data found when processing input');
        });

        it('records the attempt time even when a retry fails the same way', async function () {
            const oblecto = createOblecto();
            const file = await File.create({ path: '/media/Movies/a.mkv' });

            await markProblematic(oblecto, file, 'identify', 'Could not identify');
            const first = file.updatedAt.getTime();

            await new Promise(resolve => setTimeout(resolve, 5));
            await markProblematic(oblecto, file, 'identify', 'Could not identify');
            await file.reload();

            assert.ok(file.updatedAt.getTime() > first);
        });

        it('does not let a different stage clear the problem', async function () {
            const oblecto = createOblecto();
            const file = await File.create({ path: '/media/Movies/a.mkv' });

            await markProblematic(oblecto, file, 'identify', 'Could not identify');
            await clearProblem(oblecto, file, 'probe');
            await file.reload();

            assert.equal(file.problematic, true);
            assert.equal(file.problemStage, 'identify');

            await clearProblem(oblecto, file, 'identify');
            await file.reload();

            assert.equal(file.problematic, false);
            assert.equal(file.problemStage, null);
            assert.equal(file.error, null);
        });

        it('lets any stage clear a problem recorded without a stage', async function () {
            const oblecto = createOblecto();
            const file = await File.create({
                path: '/media/Movies/a.mkv',
                problematic: true,
                error: 'old'
            });

            await clearProblem(oblecto, file, 'probe');
            await file.reload();

            assert.equal(file.problematic, false);
        });
    });

    describe('retryProblem', function () {
        it('re-probes files that failed probing', async function () {
            const oblecto = createOblecto();
            const file = await File.create({
                path: '/media/TV/a.mkv',
                problematic: true,
                problemStage: 'probe'
            });

            assert.deepEqual(await retryProblem(oblecto, file), { status: 'queued', jobs: ['indexFileStreams', 'updateFileFFProbe'] });
        });

        it('re-identifies by library type', async function () {
            const oblecto = createOblecto();
            const movie = await File.create({
                path: '/media/Movies/a.mkv',
                problematic: true,
                problemStage: 'identify'
            });
            const episode = await File.create({
                path: '/media/TV/a.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            assert.deepEqual(await retryProblem(oblecto, movie), { status: 'queued', jobs: ['identifyMovieFile'] });
            assert.deepEqual(await retryProblem(oblecto, episode), { status: 'queued', jobs: ['identifyEpisodeFile'] });
            assert.deepEqual(oblecto.queue.queued, [
                { id: 'identifyMovieFile', attr: { fileId: movie.id } },
                { id: 'identifyEpisodeFile', attr: { fileId: episode.id } }
            ]);
        });

        it('classifies legacy rows by whether media is linked', async function () {
            const oblecto = createOblecto();
            const linked = await File.create({ path: '/media/Movies/linked.mkv', problematic: true });
            const unlinked = await File.create({ path: '/media/Movies/unlinked.mkv', problematic: true });
            const movie = await Movie.create({ movieName: 'Linked' });

            await MovieFiles.create({ MovieId: movie.id, FileId: linked.id });

            assert.deepEqual(await retryProblem(oblecto, linked), { status: 'queued', jobs: ['indexFileStreams', 'updateFileFFProbe'] });
            assert.deepEqual(await retryProblem(oblecto, unlinked), { status: 'queued', jobs: ['identifyMovieFile'] });
        });

        it('removes files that no longer exist instead of retrying them', async function () {
            const oblecto = createOblecto();
            const file = await File.create({
                path: '/media/Movies/missing.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            assert.deepEqual(await retryProblem(oblecto, file), { status: 'missing' });
            assert.equal(await File.findByPk(file.id), null);
            assert.equal(oblecto.queue.queued.length, 0);
            assert.equal(oblecto.broadcasts[0].payload.problematic, false);
        });

        it('refuses files outside every library directory', async function () {
            const oblecto = createOblecto();
            const file = await File.create({
                path: '/media/Movies2/a.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            assert.deepEqual(await retryProblem(oblecto, file), { status: 'outside' });
            assert.equal(oblecto.queue.queued.length, 0);
        });
    });

    describe('MovieIndexer.identifyFile', function () {
        it('identifies a file already in the database and clears its problem', async function () {
            const oblecto = createOblecto();
            const indexer = new MovieIndexer(oblecto);
            const file = await File.create({
                path: '/media/Movies/Film.mkv', problematic: true, problemStage: 'identify', error: 'Could not identify'
            });

            indexer.matchFile = async () => ({ tmdbid: 42, movieName: 'Film' });

            await indexer.identifyFile(file, true);
            await file.reload();

            assert.equal(file.problematic, false);
            assert.equal(await file.countMovies(), 1);
            assert.ok(oblecto.queue.queued.some((job: any) => job.id === 'updateMovie'));
        });

        it('flags the file when identification fails', async function () {
            const oblecto = createOblecto();
            const indexer = new MovieIndexer(oblecto);
            const file = await File.create({ path: '/media/Movies/zzqx.mkv' });

            indexer.matchFile = async () => { throw new IdentificationError('Could not identify: zzqx'); };

            await indexer.identifyFile(file);
            await file.reload();

            assert.equal(file.problematic, true);
            assert.equal(file.problemStage, 'identify');
            assert.equal(file.error, 'Could not identify: zzqx');
        });

        it('flags and rethrows unexpected errors', async function () {
            const oblecto = createOblecto();
            const indexer = new MovieIndexer(oblecto);
            const file = await File.create({ path: '/media/Movies/Film.mkv' });

            indexer.matchFile = async () => { throw new Error('socket hang up'); };

            await assert.rejects(indexer.identifyFile(file), /socket hang up/);
            await file.reload();

            assert.equal(file.problemStage, 'identify');
            assert.equal(file.error, 'socket hang up');
        });
    });

    describe('SeriesIndexer.identifyFile', function () {
        it('identifies a file already in the database and clears its problem', async function () {
            const oblecto = createOblecto();
            const indexer = new SeriesIndexer(oblecto);
            const file = await File.create({
                path: '/media/TV/Show/S01E02.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            indexer.identify = async () => ({
                series: { tmdbid: 7, seriesName: 'Show' },
                episode: {
                    airedSeason: 1,
                    airedEpisodeNumber: 2,
                    episodeName: 'Two'
                }
            });

            await indexer.identifyFile(file);
            await file.reload();

            assert.equal(file.problematic, false);
            assert.equal(await file.countEpisodes(), 1);
        });
    });

    describe('identify jobs', function () {
        it('re-identify a file by id, which is how retries reach the indexers', async function () {
            const oblecto = createOblecto();
            const movieIndexer = new MovieIndexer(oblecto);
            const seriesIndexer = new SeriesIndexer(oblecto);
            const movie = await File.create({ path: '/media/Movies/Film.mkv' });
            const episode = await File.create({ path: '/media/TV/Show/S01E02.mkv' });
            const calls: Array<[string, number, boolean | undefined]> = [];

            movieIndexer.identifyFile = async (file, doReindex) => { calls.push(['movie', file.id, doReindex]); };
            seriesIndexer.identifyFile = async (file) => { calls.push(['episode', file.id, undefined]); };

            await oblecto.queue.jobs.identifyMovieFile({ fileId: movie.id });
            await oblecto.queue.jobs.identifyEpisodeFile({ fileId: episode.id });
            await oblecto.queue.jobs.identifyMovieFile({ fileId: 999 });

            assert.deepEqual(calls, [['movie', movie.id, true], ['episode', episode.id, undefined]]);
        });
    });

    describe('routes', function () {
        const setup = () => {
            const oblecto = createOblecto();
            const server = makeServer();

            filesRoutes(server as any, oblecto);

            return { oblecto, server };
        };

        it('lists problematic files with linked media, hiding ignored ones by default', async function () {
            const { server } = setup();
            const movie = await Movie.create({ movieName: 'Film' });
            const unreadable = await File.create({
                path: '/media/Movies/film.mkv',
                problematic: true,
                problemStage: 'probe'
            });

            await MovieFiles.create({ MovieId: movie.id, FileId: unreadable.id });
            await File.create({
                path: '/media/Movies/zzqx.mkv',
                problematic: true,
                problemStage: 'identify'
            });
            await File.create({
                path: '/media/Movies/sample.mkv',
                problematic: true,
                problemStage: 'identify',
                problemIgnored: true
            });
            await File.create({ path: '/media/Movies/fine.mkv' });

            const all = await call(server, 'GET /files/problematic', { query: {} });
            const paths = all.body.map((f: File) => f.path).sort();

            assert.deepEqual(paths, ['/media/Movies/film.mkv', '/media/Movies/zzqx.mkv']);

            const probe = await call(server, 'GET /files/problematic', { query: { stage: 'probe' } });

            assert.equal(probe.body.length, 1);
            assert.equal(probe.body[0].Movies[0].movieName, 'Film');

            const withIgnored = await call(server, 'GET /files/problematic', { query: { includeIgnored: 'true' } });

            assert.equal(withIgnored.body.length, 3);
        });

        it('queues a retry without clearing the flag', async function () {
            const { oblecto, server } = setup();
            const file = await File.create({
                path: '/media/Movies/zzqx.mkv',
                problematic: true,
                problemStage: 'identify',
                error: 'nope'
            });

            const res = await call(server, 'POST /files/:id/retry', { params: { id: String(file.id) } });
            await file.reload();

            assert.equal(res.statusCode, 202);
            assert.deepEqual(res.body, { queued: true, jobs: ['identifyMovieFile'] });
            assert.equal(file.problematic, true);
            assert.equal(file.error, 'nope');
            assert.deepEqual(oblecto.queue.queued, [{ id: 'identifyMovieFile', attr: { fileId: file.id } }]);
        });

        it('rejects retries it cannot perform', async function () {
            const { server } = setup();
            const fine = await File.create({ path: '/media/Movies/fine.mkv' });
            const outside = await File.create({
                path: '/elsewhere/a.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            assert.equal((await call(server, 'POST /files/:id/retry', { params: { id: '999' } })).statusCode, 404);
            assert.equal((await call(server, 'POST /files/:id/retry', { params: { id: String(fine.id) } })).statusCode, 409);
            assert.equal((await call(server, 'POST /files/:id/retry', { params: { id: String(outside.id) } })).statusCode, 400);
        });

        it('answers 410 when the file is gone from disk', async function () {
            const { server } = setup();
            const gone = await File.create({
                path: '/media/Movies/missing.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            const res = await call(server, 'POST /files/:id/retry', { params: { id: String(gone.id) } });

            assert.equal(res.statusCode, 410);
            assert.equal(await File.findByPk(gone.id), null);
        });

        it('retries every non-ignored problem in bulk', async function () {
            const { oblecto, server } = setup();

            await File.create({
                path: '/media/Movies/a.mkv',
                problematic: true,
                problemStage: 'identify'
            });
            await File.create({
                path: '/media/TV/b.mkv',
                problematic: true,
                problemStage: 'probe'
            });
            await File.create({
                path: '/media/Movies/c.mkv',
                problematic: true,
                problemStage: 'identify',
                problemIgnored: true
            });
            const outside = await File.create({
                path: '/elsewhere/d.mkv',
                problematic: true,
                problemStage: 'identify'
            });
            const gone = await File.create({
                path: '/media/Movies/missing.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            const res = await call(server, 'POST /files/problematic/retry', { body: {} });

            assert.equal(res.statusCode, 202);
            assert.deepEqual(res.body, {
                queued: 2,
                removedIds: [gone.id],
                skippedIds: [outside.id]
            });
            assert.deepEqual(oblecto.queue.queued.map((job: { id: string }) => job.id).sort(), ['identifyMovieFile', 'indexFileStreams', 'updateFileFFProbe']);

            oblecto.queue.queued = [];

            const probeOnly = await call(server, 'POST /files/problematic/retry', { body: { stage: 'probe' } });

            assert.deepEqual(probeOnly.body, {
                queued: 1,
                removedIds: [],
                skippedIds: []
            });
        });

        it('ignores and un-ignores a file', async function () {
            const { server } = setup();
            const file = await File.create({
                path: '/media/Movies/sample.mkv',
                problematic: true,
                problemStage: 'identify'
            });

            const bad = await call(server, 'PATCH /files/:id', { params: { id: String(file.id) }, body: { problemIgnored: 'yes' } });

            assert.equal(bad.statusCode, 400);

            const res = await call(server, 'PATCH /files/:id', { params: { id: String(file.id) }, body: { problemIgnored: true } });
            await file.reload();

            assert.deepEqual(res.body, { id: file.id, problemIgnored: true });
            assert.equal(file.problemIgnored, true);
        });
    });
});
