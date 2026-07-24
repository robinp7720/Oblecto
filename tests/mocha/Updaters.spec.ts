import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';

import MovieUpdater from '../../src/lib/updaters/movies/MovieUpdater.js';
import TmdbMovieRetriever from '../../src/lib/updaters/movies/informationRetrievers/TmdbMovieRetriever.js';
import SeriesUpdater from '../../src/lib/updaters/series/SeriesUpdater.js';
import TmdbSeriesRetriever from '../../src/lib/updaters/series/informationRetrievers/TmdbSeriesRetriever.js';
import TvdbSeriesRetriever from '../../src/lib/updaters/series/informationRetrievers/TvdbSeriesRetriever.js';
import TmdbEpisodeRetriever from '../../src/lib/updaters/series/informationRetrievers/TmdbEpisodeRetriever.js';
import TvdbEpisodeRetriever from '../../src/lib/updaters/series/informationRetrievers/TvdbEpisodeRetriever.js';

import { Movie, movieColumns } from '../../src/models/movie.js';
import { MovieSet, movieSetColumns } from '../../src/models/movieSet.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import Queue from '../../src/lib/queue/index.js';
import DebugExtendableError from '../../src/lib/errors/DebugExtendableError.js';
import logger from '../../src/submodules/logger/index.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

const makeOblecto = (overrides: Record<string, any> = {}) => ({
    queue: new Queue(1),
    config: {
        movies: { movieUpdaters: ['tmdb'] },
        tvshows: { seriesUpdaters: ['tmdb'], episodeUpdaters: ['tmdb'] }
    },
    ...overrides
}) as unknown as Oblecto;

describe('Movie/Series updaters', () => {
    let sequelize: Sequelize;

    before(async () => {
        logger.silent = true;

        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        MovieSet.init(movieSetColumns, { sequelize, modelName: 'MovieSet' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });

        MovieSet.belongsToMany(Movie, { through: 'MovieSetAllocations' });
        Movie.belongsToMany(MovieSet, { through: 'MovieSetAllocations' });

        Episode.belongsTo(Series);
        Series.hasMany(Episode);

        await sequelize.sync({ force: true });
    });

    after(() => { logger.silent = false; });

    afterEach(async () => {
        await Episode.destroy({ where: {}, truncate: true, cascade: true });
        await Series.destroy({ where: {}, truncate: true, cascade: true });
        await Movie.destroy({ where: {}, truncate: true, cascade: true });
        await MovieSet.destroy({ where: {}, truncate: true, cascade: true });
    });

    describe('TmdbMovieRetriever', () => {
        it('maps TMDB movie info fields and passes through the collection as _set', async () => {
            const oblecto = makeOblecto({
                tmdb: {
                    movieInfo: async () => ({
                        imdb_id: 'tt123',
                        title: 'Catch-22',
                        original_title: 'Catch-22',
                        tagline: 'a tagline',
                        genres: [{ name: 'War' }, { name: 'Comedy' }],
                        original_language: 'en',
                        budget: 100,
                        revenue: 200,
                        runtime: 118,
                        overview: 'x',
                        popularity: 5.4,
                        release_date: '1970-06-24',
                        belongs_to_collection: { id: 9, name: 'Catch-22 Collection' }
                    })
                }
            });
            const retriever = new TmdbMovieRetriever(oblecto);

            const data = await retriever.retrieveInformation({ tmdbid: 82744 } as any);

            assert.equal(data.imdbid, 'tt123');
            assert.equal(data.movieName, 'Catch-22');
            assert.equal(data.genres, JSON.stringify(['War', 'Comedy']));
            assert.deepEqual(data._set, { id: 9, name: 'Catch-22 Collection' });
        });
    });

    describe('MovieUpdater', () => {
        it('updates the movie and creates/attaches a movie set when _set is present', async () => {
            const oblecto = makeOblecto({
                tmdb: {
                    movieInfo: async () => ({
                        imdb_id: 'tt1',
                        title: 'Catch-22',
                        genres: [],
                        belongs_to_collection: { id: 42, name: 'War Films' }
                    })
                }
            });
            const updater = new MovieUpdater(oblecto);

            const movie = await Movie.create({ tmdbid: 1 });
            await updater.updateMovie(movie);

            await movie.reload();
            assert.equal(movie.movieName, 'Catch-22');
            assert.equal(movie.imdbid, 'tt1');

            const set = await MovieSet.findOne({ where: { tmdbid: 42 } });
            assert.ok(set);
            assert.equal(set!.setName, 'War Films');

            const movies = await set!.getMovies();
            assert.equal(movies.length, 1);
            assert.equal(movies[0].id, movie.id);
        });

        it('updates an existing set name when it has changed upstream', async () => {
            await MovieSet.create({ tmdbid: 42, setName: 'Old Name' });

            const oblecto = makeOblecto({
                tmdb: { movieInfo: async () => ({ title: 'X', genres: [], belongs_to_collection: { id: 42, name: 'New Name' } }) }
            });
            const updater = new MovieUpdater(oblecto);
            const movie = await Movie.create({ tmdbid: 2 });

            await updater.updateMovie(movie);

            const set = await MovieSet.findOne({ where: { tmdbid: 42 } });
            assert.equal(set!.setName, 'New Name');
        });

        it('updates the movie without touching movie sets when no _set is present', async () => {
            const oblecto = makeOblecto({
                tmdb: { movieInfo: async () => ({ title: 'No Collection', genres: [], belongs_to_collection: null }) }
            });
            const updater = new MovieUpdater(oblecto);
            const movie = await Movie.create({ tmdbid: 3 });

            await updater.updateMovie(movie);

            await movie.reload();
            assert.equal(movie.movieName, 'No Collection');
            assert.equal(await MovieSet.count(), 0);
        });
    });

    describe('TmdbSeriesRetriever', () => {
        it('maps series fields and fetches external ids when missing', async () => {
            const oblecto = makeOblecto({
                tmdb: {
                    tvInfo: async () => ({
                        name: 'Stargirl', status: 'Ended', first_air_date: '2020-05-18',
                        overview: 'x', popularity: 1, vote_average: 8, vote_count: 100,
                        genres: [{ name: 'Drama' }]
                    }),
                    tvExternalIds: async () => ({ tvdb_id: 361868, imdb_id: 'tt123' })
                }
            });
            const retriever = new TmdbSeriesRetriever(oblecto);

            const data = await retriever.retrieveInformation({ tmdbid: 80986, tvdbid: null, imdbid: null } as any);

            assert.equal(data.seriesName, 'Stargirl');
            assert.equal(data.tvdbid, 361868);
            assert.equal(data.imdbid, 'tt123');
        });

        it('does not fetch external ids when both are already present', async () => {
            let called = false;
            const oblecto = makeOblecto({
                tmdb: {
                    tvInfo: async () => ({ name: 'X', genres: [] }),
                    tvExternalIds: async () => { called = true; return {}; }
                }
            });
            const retriever = new TmdbSeriesRetriever(oblecto);

            await retriever.retrieveInformation({ tmdbid: 1, tvdbid: 5, imdbid: 'tt5' } as any);

            assert.equal(called, false);
        });

        it('throws DebugExtendableError when series has no tmdbid', async () => {
            const retriever = new TmdbSeriesRetriever(makeOblecto({ tmdb: {} }));

            await assert.rejects(
                () => retriever.retrieveInformation({ tmdbid: null } as any),
                DebugExtendableError
            );
        });
    });

    describe('TvdbSeriesRetriever', () => {
        it('maps TVDB series fields directly', async () => {
            const oblecto = makeOblecto({
                tvdb: {
                    getSeriesById: async () => ({
                        seriesName: 'Stargirl', status: 'Ended', firstAired: '2020-05-18',
                        overview: 'x', siteRating: 8, siteRatingCount: 100, rating: 'TV-PG',
                        airsDayOfWeek: 'Monday', airsTime: '8:00 PM', network: 'The CW',
                        imdbId: 'tt123', zap2itId: 'z1'
                    })
                }
            });
            const retriever = new TvdbSeriesRetriever(oblecto);

            const data = await retriever.retrieveInformation({ tvdbid: 361868 } as any);

            assert.equal(data.seriesName, 'Stargirl');
            assert.equal(data.imdbid, 'tt123');
            assert.equal(data.network, 'The CW');
        });

        it('throws DebugExtendableError when series has no tvdbid', async () => {
            const retriever = new TvdbSeriesRetriever(makeOblecto({ tvdb: {} }));

            await assert.rejects(
                () => retriever.retrieveInformation({ tvdbid: null } as any),
                DebugExtendableError
            );
        });
    });

    describe('SeriesUpdater', () => {
        it('updates a series entity with retrieved data', async () => {
            const oblecto = makeOblecto({
                tmdb: { tvInfo: async () => ({ name: 'Stargirl', genres: [] }), tvExternalIds: async () => ({}) }
            });
            const updater = new SeriesUpdater(oblecto);

            const series = await Series.create({ tmdbid: 80986 });
            await updater.updateSeries(series);

            await series.reload();
            assert.equal(series.seriesName, 'Stargirl');
        });

        it('updates an episode entity using its parent series tmdbid', async () => {
            const oblecto = makeOblecto({
                tmdb: {
                    episodeInfo: async () => ({ id: 1, name: 'Pilot', episode_number: 1, season_number: 1, overview: 'x', air_date: '2020-01-01' }),
                    episodeExternalIds: async () => ({ tvdb_id: 5, imdb_id: 'tt5' })
                }
            });
            const updater = new SeriesUpdater(oblecto);

            const series = await Series.create({ tmdbid: 80986 });
            const episode = await Episode.create({ airedSeason: '1', airedEpisodeNumber: '1', SeriesId: series.id });

            await updater.updateEpisode(episode);

            await episode.reload();
            assert.equal(episode.episodeName, 'Pilot');
            assert.equal(episode.tvdbid, 5);
        });
    });

    describe('TmdbEpisodeRetriever', () => {
        it('throws DebugExtendableError when the parent series has no tmdbid', async () => {
            const oblecto = makeOblecto({ tmdb: {} });
            const retriever = new TmdbEpisodeRetriever(oblecto);

            const fakeEpisode = { airedSeason: '1', airedEpisodeNumber: '1', getSeries: async () => ({ tmdbid: null }) };

            await assert.rejects(() => retriever.retrieveInformation(fakeEpisode as any), DebugExtendableError);
        });
    });

    describe('TvdbEpisodeRetriever', () => {
        it('throws DebugExtendableError when episode has no tvdbid', async () => {
            const retriever = new TvdbEpisodeRetriever(makeOblecto({ tvdb: {} }));

            await assert.rejects(() => retriever.retrieveInformation({ tvdbid: null } as any), DebugExtendableError);
        });

        it('returns a normalized data object for a valid tvdbid', async () => {
            const rawInfo = {
                episodeName: 'Pilot', airedEpisodeNumber: 1, airedSeason: 1,
                overview: 'x', firstAired: '2020-01-01', dvdEpisodeNumber: 1, dvdSeason: 1,
                absoluteNumber: 1, imdbId: 'tt9'
            };
            const oblecto = makeOblecto({ tvdb: { getEpisodeById: async () => rawInfo } });
            const retriever = new TvdbEpisodeRetriever(oblecto);

            const result = await retriever.retrieveInformation({ tvdbid: 5 } as any) as Record<string, unknown>;

            assert.equal(result.episodeName, 'Pilot');
            assert.equal(result.airedEpisodeNumber, 1);
            assert.equal(result.imdbid, 'tt9');
            // The raw TVDB field name is `imdbId`; only the normalized `imdbid` should be present.
            assert.equal(result.imdbId, undefined);
        });

        it('omits imdbid when the TVDB response has none', async () => {
            const rawInfo = { episodeName: 'Pilot', airedEpisodeNumber: 1, airedSeason: 1 };
            const oblecto = makeOblecto({ tvdb: { getEpisodeById: async () => rawInfo } });
            const retriever = new TvdbEpisodeRetriever(oblecto);

            const result = await retriever.retrieveInformation({ tvdbid: 5 } as any) as Record<string, unknown>;

            assert.equal(result.imdbid, undefined);
        });
    });
});
