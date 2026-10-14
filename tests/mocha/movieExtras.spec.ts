import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { MovieDb } from 'moviedb-promise';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { MovieExtras, movieTrailers, movieCertifications } from '../../src/lib/movies/MovieExtras.js';

const trailer = { type: 'Trailer' as const, name: 'Official trailer', site: 'YouTube', key: 'abc123DEF_-', iso_639_1: 'en', official: true };
const certificates = { results: [{ iso_3166_1: 'US', release_dates: [
    { certification: '', type: 1 }, { certification: 'R', type: 4, release_date: '2021-01-01' },
    { certification: 'PG-13', type: 3, release_date: '2020-01-01' }
] }] };

describe('Movie trailer and certification cache', () => {
    let sequelize: Sequelize;
    beforeEach(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        await Movie.sync({ force: true });
    });
    afterEach(async () => { await sequelize.close(); });

    it('keeps only supported trailer links, deduplicates them and prefers official trailers', () => {
        const trailers = movieTrailers({ results: [
            { ...trailer, official: false, key: 'ABCDEFGHIJK' }, trailer, trailer,
            { ...trailer, key: 'javascript:alert(1)' }, { ...trailer, site: 'Elsewhere' },
            { ...trailer, type: 'Clip', key: 'zyx987ZYX_-' }
        ] });
        assert.equal(trailers.length, 2);
        assert.equal(trailers[0].key, trailer.key);
        assert.equal(trailers[0].official, true);
        assert.deepEqual(movieCertifications(certificates), [{ country: 'US', certification: 'PG-13' }]);
        assert.throws(() => movieTrailers({ results: null }));
        assert.throws(() => movieTrailers({ results: [null] }));
        assert.throws(() => movieTrailers({ results: [{}] }));
        assert.throws(() => movieCertifications({ results: [{ iso_3166_1: 'US' }] }));
        assert.throws(() => movieCertifications({ results: [{ iso_3166_1: 'US', release_dates: [{}] }] }));
    });

    it('shares simultaneous requests and persists a seven-day cache across service instances', async () => {
        let videoCalls = 0;
        let certificationCalls = 0;
        const provider: Pick<MovieDb, 'movieVideos' | 'movieReleaseDates'> = {
            movieVideos: async () => { videoCalls++; return { results: [trailer] }; },
            movieReleaseDates: async () => { certificationCalls++; return certificates; }
        };
        const movie = await Movie.create({ tmdbid: 123, movieName: 'Example' });
        const updatedAt = movie.updatedAt.getTime();
        const service = new MovieExtras(provider);
        const [first, second] = await Promise.all([service.get(movie), service.get(movie)]);
        assert.deepEqual(first, second);
        assert.equal(first.unavailable, false);
        assert.equal(first.trailers.length, 1);
        await movie.reload();
        assert.equal(movie.updatedAt.getTime(), updatedAt);
        assert.ok(movie.trailersUpdatedAt);
        assert.deepEqual(await new MovieExtras(provider).get(movie), first);
        assert.equal(videoCalls, 1);
        assert.equal(certificationCalls, 1);
    });

    it('refreshes expired fields independently and keeps good data when one provider request fails', async () => {
        const old = new Date(Date.now() - 8 * 86400000);
        const movie = await Movie.create({ tmdbid: 123, trailers: movieTrailers({ results: [trailer] }), trailersUpdatedAt: old, certificationsUpdatedAt: old });
        let certificateCalls = 0;
        const provider: Pick<MovieDb, 'movieVideos' | 'movieReleaseDates'> = {
            movieVideos: async () => { throw new Error('offline'); },
            movieReleaseDates: async () => { certificateCalls++; return certificates; }
        };
        const result = await new MovieExtras(provider).get(movie);
        assert.equal(result.unavailable, true);
        assert.equal(result.trailers[0].name, trailer.name);
        assert.equal(result.certifications[0].certification, 'PG-13');
        await movie.reload();
        assert.equal(movie.trailersUpdatedAt?.getTime(), old.getTime());
        provider.movieVideos = async () => ({ results: [] });
        const retry = await new MovieExtras(provider).get(movie);
        assert.equal(retry.unavailable, false);
        assert.deepEqual(retry.trailers, []);
        assert.equal(certificateCalls, 1);
    });

    it('does not contact TMDB for unidentified movies', async () => {
        const movie = await Movie.create({ movieName: 'Unmatched' });
        const fail = async (): Promise<never> => { throw new Error('must not be called'); };
        const result = await new MovieExtras({ movieVideos: fail, movieReleaseDates: fail }).get(movie);
        assert.deepEqual(result, { trailers: [], certifications: [], unavailable: false });
    });
});
