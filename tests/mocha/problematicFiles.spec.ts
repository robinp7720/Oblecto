/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';

import { Movie, movieColumns } from '../../src/models/movie.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';

import MovieIndexer from '../../src/lib/indexers/movies/MovieIndexer.js';
import SeriesIndexer from '../../src/lib/indexers/series/SeriesIndexer.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import { clearProblem, markProblematic } from '../../src/lib/indexers/files/problems.js';
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

    before(async function () {
        logger.silent = true;

        sequelize = new Sequelize({
            dialect: 'sqlite',
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
        logger.silent = false;
        await sequelize.close();
    });

    beforeEach(async function () {
        await sequelize.sync({ force: true });
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
});
