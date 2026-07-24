import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import MovieIndexer from '../../src/lib/indexers/movies/MovieIndexer.js';
import guessit from '../../src/submodules/guessit.js';
import Queue from '../../src/lib/queue/index.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { File, fileColumns } from '../../src/models/file.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import logger from '../../src/submodules/logger/index.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

describe('MovieIndexer', () => {
    let sequelize: Sequelize;
    const originalIdentify = guessit.identify;

    before(async () => {
        logger.silent = true;

        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });

        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });

        await sequelize.sync({ force: true });
    });

    after(() => {
        logger.silent = false;
        guessit.identify = originalIdentify;
    });

    afterEach(async () => {
        guessit.identify = originalIdentify;
        await Movie.destroy({ where: {}, truncate: true });
        await File.destroy({ where: {}, truncate: true });
    });

    const makeOblecto = (overrides: Record<string, any> = {}) => {
        const queue = new Queue(1);
        const queuedJobs: Array<{ id: string; attr: any; priority: string }> = [];

        queue.queueJob = ((id: string, attr: any) => { queuedJobs.push({ id, attr, priority: 'normal' }); }) as any;
        queue.pushJob = ((id: string, attr: any) => { queuedJobs.push({ id, attr, priority: 'high' }); }) as any;

        const broadcasts: Array<{ channel: string; payload: any }> = [];

        const oblecto = {
            config: { movies: { movieIdentifiers: ['tmdb'] } },
            queue,
            tmdb: {},
            realTimeController: { broadcast: (channel: string, payload: any) => { broadcasts.push({ channel, payload }); } },
            fileIndexer: {
                indexVideoFile: async (path: string) => File.create({ path, host: 'local', problematic: false })
            },
            queuedJobs,
            broadcasts,
            ...overrides
        };

        return oblecto as unknown as Oblecto & { queuedJobs: typeof queuedJobs; broadcasts: typeof broadcasts };
    };

    describe('matchFile', () => {
        it('returns the identification when the identifier succeeds on the first try', async () => {
            guessit.identify = (async () => ({ title: 'Catch-22', year: 2019, type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [{ id: 1, title: 'Catch-22' }] }) } });
            const indexer = new MovieIndexer(oblecto);

            const result = await indexer.matchFile('/x/Catch-22.mkv');

            assert.equal(result.tmdbid, 1);
        });

        it('retries without the year when identification fails with a year present', async () => {
            guessit.identify = (async () => ({ title: 'Catch-22', year: 1999, type: 'movie' })) as any;

            let receivedQueries: any[] = [];
            const oblecto = makeOblecto({
                tmdb: {
                    searchMovie: async (query: any) => {
                        receivedQueries.push(query);
                        if (query.primary_release_year) return { results: [] };
                        return { results: [{ id: 42, title: 'Catch-22' }] };
                    }
                }
            });
            const indexer = new MovieIndexer(oblecto);

            const result = await indexer.matchFile('/x/Catch-22.mkv');

            assert.equal(result.tmdbid, 42);
            assert.equal(receivedQueries.length, 2);
            assert.equal(receivedQueries[0].primary_release_year, 1999);
            assert.equal(receivedQueries[1].primary_release_year, undefined);
        });

        it('throws IdentificationError when both attempts fail', async () => {
            guessit.identify = (async () => ({ title: 'Unknown', year: 1999, type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [] }) } });
            const indexer = new MovieIndexer(oblecto);

            await assert.rejects(() => indexer.matchFile('/x/Unknown.mkv'), IdentificationError);
        });

        it('throws IdentificationError directly when no year was present to retry with', async () => {
            guessit.identify = (async () => ({ title: 'Unknown', type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [] }) } });
            const indexer = new MovieIndexer(oblecto);

            await assert.rejects(() => indexer.matchFile('/x/Unknown.mkv'), IdentificationError);
        });
    });

    describe('indexFile', () => {
        it('creates a new movie, links the file, broadcasts and queues follow-up jobs', async () => {
            guessit.identify = (async () => ({ title: 'Catch-22', year: 2019, type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [{ id: 77, title: 'Catch-22', overview: 'x' }] }) } });
            const indexer = new MovieIndexer(oblecto);

            await indexer.indexFile('/x/Catch-22.mkv');

            const movie = await Movie.findOne({ where: { tmdbid: 77 } });
            assert.ok(movie);

            const files = await movie!.getFiles();
            assert.equal(files.length, 1);

            assert.equal(oblecto.broadcasts.length, 1);
            assert.equal(oblecto.broadcasts[0].payload.type, 'movie');

            const jobIds = oblecto.queuedJobs.map(j => j.id).sort();
            assert.deepEqual(jobIds, ['downloadMovieFanart', 'downloadMoviePoster', 'updateMovie']);
        });

        it('marks the file as problematic and does not create a movie when identification fails', async () => {
            guessit.identify = (async () => ({ title: 'Unknown', type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [] }) } });
            const indexer = new MovieIndexer(oblecto);

            await indexer.indexFile('/x/Unknown.mkv');

            const file = await File.findOne({ where: { path: '/x/Unknown.mkv' } });
            assert.equal(file!.problematic, true);
            assert.ok(file!.error);

            const movieCount = await Movie.count();
            assert.equal(movieCount, 0);
            assert.equal(oblecto.broadcasts.length, 0);
        });

        it('does not re-broadcast or re-queue jobs for an existing movie without doReindex', async () => {
            guessit.identify = (async () => ({ title: 'Catch-22', year: 2019, type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [{ id: 55, title: 'Catch-22' }] }) } });

            await Movie.create({ tmdbid: 55, movieName: 'Catch-22' });

            const indexer = new MovieIndexer(oblecto);
            await indexer.indexFile('/x/Catch-22.mkv');

            assert.equal(oblecto.broadcasts.length, 0);
            assert.equal(oblecto.queuedJobs.length, 0);
        });

        it('re-broadcasts and re-queues jobs for an existing movie when doReindex is set', async () => {
            guessit.identify = (async () => ({ title: 'Catch-22', year: 2019, type: 'movie' })) as any;

            const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [{ id: 66, title: 'Catch-22' }] }) } });

            await Movie.create({ tmdbid: 66, movieName: 'Catch-22' });

            const indexer = new MovieIndexer(oblecto);
            await indexer.indexFile('/x/Catch-22.mkv', true);

            assert.equal(oblecto.broadcasts.length, 1);
            assert.equal(oblecto.queuedJobs.length, 3);
        });
    });
});
