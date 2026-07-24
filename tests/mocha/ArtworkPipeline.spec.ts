import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';

import AggregateMovieArtworkRetriever from '../../src/lib/artwork/movies/AggregateMovieArtworkRetriever.js';
import MovieArtworkCollector from '../../src/lib/artwork/movies/MovieArtworkCollector.js';
import MovieArtworkDownloader from '../../src/lib/artwork/movies/MovieArtworkDownloader.js';
import AggregateSeriesArtworkRetriever from '../../src/lib/artwork/series/AggregateSeriesArtworkRetriever.js';
import SeriesArtworkCollector from '../../src/lib/artwork/series/SeriesArtworkCollector.js';
import SeriesArtworkDownloader from '../../src/lib/artwork/series/SeriesArtworkDownloader.js';
import TmdbSeriesArtworkRetriever from '../../src/lib/artwork/series/artworkRetrievers/TmdbSeriesArtworkRetriever.js';
import TvdbSeriesArtworkRetriever from '../../src/lib/artwork/series/artworkRetrievers/TvdbSeriesArtworkRetriever.js';
import FanarttvSeriesArtworkRetriever from '../../src/lib/artwork/series/artworkRetrievers/FanarttvSeriesArtworkRetriever.js';
import Downloader from '../../src/lib/downloader/index.js';
import ArtworkUtils from '../../src/lib/artwork/ArtworkUtils.js';
import Queue from '../../src/lib/queue/index.js';
import DebugExtendableError from '../../src/lib/errors/DebugExtendableError.js';
import WarnExtendableError from '../../src/lib/errors/WarnExtendableError.js';

import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import logger from '../../src/submodules/logger/index.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

const config = {
    assets: {
        episodeBannerLocation: '/assets/banners',
        showPosterLocation: '/assets/showposters',
        moviePosterLocation: '/assets/movieposters',
        movieFanartLocation: '/assets/moviefanart'
    },
    artwork: {
        banner: { small: 200 },
        poster: { small: 100, medium: 300 },
        fanart: { large: 1000 }
    },
    'fanart.tv': { key: 'test-key' }
};

describe('Artwork pipeline', () => {
    let sequelize: Sequelize;
    const originalAttemptDownload = Downloader.attemptDownload;

    before(async () => {
        logger.silent = true;

        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        Episode.belongsTo(Series);
        Series.hasMany(Episode);

        await sequelize.sync({ force: true });
    });

    after(() => {
        logger.silent = false;
        Downloader.attemptDownload = originalAttemptDownload;
    });

    afterEach(async () => {
        Downloader.attemptDownload = originalAttemptDownload;
        await Episode.destroy({ where: {}, truncate: true, cascade: true });
        await Series.destroy({ where: {}, truncate: true, cascade: true });
        await Movie.destroy({ where: {}, truncate: true, cascade: true });
    });

    const makeOblecto = (overrides: Record<string, any> = {}) => {
        const oblecto = {
            config,
            queue: new Queue(1),
            ...overrides
        };
        oblecto.artworkUtils = new ArtworkUtils(oblecto as unknown as Oblecto);
        return oblecto as unknown as Oblecto;
    };

    describe('AggregateMovieArtworkRetriever', () => {
        it('downloads from the first retriever that returns urls', async () => {
            const calls: Array<{ urls: string[]; path: string }> = [];
            Downloader.attemptDownload = (async (urls: string[], path: string) => { calls.push({ urls, path }); }) as any;

            const oblecto = makeOblecto();
            const aggregate = new AggregateMovieArtworkRetriever(oblecto);

            aggregate.loadRetriever({ retrieveFanart: async () => [], retrievePoster: async () => ['http://x/poster.jpg'] });

            const movie = { id: 1, movieName: 'X' } as any;
            await aggregate.retrievePoster(movie);

            assert.equal(calls.length, 1);
            assert.deepEqual(calls[0].urls, ['http://x/poster.jpg']);
        });

        it('falls through to the next retriever when the first yields no urls', async () => {
            const calls: string[][] = [];
            Downloader.attemptDownload = (async (urls: string[]) => { calls.push(urls); }) as any;

            const oblecto = makeOblecto();
            const aggregate = new AggregateMovieArtworkRetriever(oblecto);

            aggregate.loadRetriever({ retrieveFanart: async () => [], retrievePoster: async () => [] });
            aggregate.loadRetriever({ retrieveFanart: async () => [], retrievePoster: async () => ['http://y/poster.jpg'] });

            await aggregate.retrievePoster({ id: 1, movieName: 'X' } as any);

            assert.deepEqual(calls, [['http://y/poster.jpg']]);
        });

        it('throws WarnExtendableError when no retriever produces urls', async () => {
            const oblecto = makeOblecto();
            const aggregate = new AggregateMovieArtworkRetriever(oblecto);

            aggregate.loadRetriever({ retrieveFanart: async () => [], retrievePoster: async () => [] });

            await assert.rejects(() => aggregate.retrievePoster({ id: 1, movieName: 'X' } as any), WarnExtendableError);
        });
    });

    describe('MovieArtworkCollector', () => {
        it('queues a download job when artwork does not exist on disk', async () => {
            const oblecto = makeOblecto();
            const collector = new MovieArtworkCollector(oblecto);
            const queued: any[] = [];
            oblecto.queue.queueJob = ((id: string, attr: any) => queued.push({ id, attr })) as any;

            const movie = await Movie.create({ movieName: 'X' });
            await collector.collectArtworkMoviePoster(movie);

            assert.deepEqual(queued, [{ id: 'downloadMoviePoster', attr: movie }]);
        });

        it('collectAll processes every movie for both posters and fanart', async () => {
            const oblecto = makeOblecto();
            const collector = new MovieArtworkCollector(oblecto);
            const queued: any[] = [];
            oblecto.queue.queueJob = ((id: string, attr: any) => queued.push(id)) as any;

            await Movie.create({ movieName: 'A' });
            await Movie.create({ movieName: 'B' });

            await collector.collectAll();

            assert.equal(queued.filter(id => id === 'downloadMoviePoster').length, 2);
            assert.equal(queued.filter(id => id === 'downloadMovieFanart').length, 2);
        });
    });

    describe('MovieArtworkDownloader', () => {
        it('pushes a rescaleImage job per configured poster size after downloading', async () => {
            const oblecto = makeOblecto();
            const downloader = new MovieArtworkDownloader(oblecto);

            downloader.movieArtworkRetriever = {
                retrieveFanart: async () => {},
                retrievePoster: async () => {}
            } as any;

            const pushed: any[] = [];
            oblecto.queue.pushJob = ((id: string, attr: any) => pushed.push(attr)) as any;

            const movie = { id: 1, movieName: 'X' } as any;
            await downloader.downloadMoviePoster(movie);

            assert.equal(pushed.length, 2);
            assert.deepEqual(pushed.map(p => p.width).sort(), [100, 300]);
        });
    });

    describe('AggregateSeriesArtworkRetriever', () => {
        it('downloads the banner from the first retriever with urls', async () => {
            const calls: string[][] = [];
            Downloader.attemptDownload = (async (urls: string[]) => { calls.push(urls); }) as any;

            const oblecto = makeOblecto();
            const aggregate = new AggregateSeriesArtworkRetriever(oblecto);
            aggregate.loadRetriever({ retrieveEpisodeBanner: async () => ['http://x/banner.jpg'], retrieveSeriesPoster: async () => [] });

            await aggregate.retrieveEpisodeBanner({ id: 1, episodeName: 'E' } as any);

            assert.deepEqual(calls, [['http://x/banner.jpg']]);
        });

        it('throws WarnExtendableError for series poster when nothing is found', async () => {
            const oblecto = makeOblecto();
            const aggregate = new AggregateSeriesArtworkRetriever(oblecto);
            aggregate.loadRetriever({ retrieveEpisodeBanner: async () => [], retrieveSeriesPoster: async () => [] });

            await assert.rejects(() => aggregate.retrieveSeriesPoster({ id: 1, seriesName: 'S' } as any), WarnExtendableError);
        });
    });

    describe('SeriesArtworkCollector', () => {
        it('queues download jobs for series posters and episode banners', async () => {
            const oblecto = makeOblecto();
            const collector = new SeriesArtworkCollector(oblecto);
            const queued: string[] = [];
            oblecto.queue.queueJob = ((id: string) => queued.push(id)) as any;

            const series = await Series.create({ seriesName: 'S' });
            await Episode.create({ episodeName: 'E', airedSeason: '1', airedEpisodeNumber: '1', SeriesId: series.id });

            await collector.collectAll();

            assert.ok(queued.includes('downloadSeriesPoster'));
            assert.ok(queued.includes('downloadEpisodeBanner'));
        });
    });

    describe('SeriesArtworkDownloader', () => {
        it('pushes a rescaleImage job per configured banner size after downloading', async () => {
            const oblecto = makeOblecto();
            const downloader = new SeriesArtworkDownloader(oblecto);

            downloader.seriesArtworkRetriever = {
                retrieveEpisodeBanner: async () => {},
                retrieveSeriesPoster: async () => {}
            } as any;

            const pushed: any[] = [];
            oblecto.queue.pushJob = ((id: string, attr: any) => pushed.push(attr)) as any;

            await downloader.downloadEpisodeBanner({ id: 1, episodeName: 'E' } as any);

            assert.equal(pushed.length, 1);
            assert.equal(pushed[0].width, 200);
        });
    });

    describe('TmdbSeriesArtworkRetriever', () => {
        it('resolves episode banner urls using the parent series tmdbid', async () => {
            const oblecto = makeOblecto({ tmdb: { episodeImages: async () => ({ stills: [{ file_path: '/a.jpg' }] }) } });
            const retriever = new TmdbSeriesArtworkRetriever(oblecto);

            const episode = { tmdbid: 1, airedSeason: '1', airedEpisodeNumber: '2', getSeries: async () => ({ tmdbid: 80986 }) } as any;
            const urls = await retriever.retrieveEpisodeBanner(episode);

            assert.deepEqual(urls, ['https://image.tmdb.org/t/p/original/a.jpg']);
        });

        it('throws when the episode has no tmdbid', async () => {
            const retriever = new TmdbSeriesArtworkRetriever(makeOblecto({ tmdb: {} }));
            await assert.rejects(() => retriever.retrieveEpisodeBanner({ tmdbid: null } as any), DebugExtendableError);
        });

        it('resolves series poster urls', async () => {
            const oblecto = makeOblecto({ tmdb: { tvImages: async () => ({ posters: [{ file_path: '/p.jpg' }] }) } });
            const retriever = new TmdbSeriesArtworkRetriever(oblecto);

            const urls = await retriever.retrieveSeriesPoster({ tmdbid: 1, seriesName: 'X' } as any);

            assert.deepEqual(urls, ['https://image.tmdb.org/t/p/original/p.jpg']);
        });

        it('throws when the series has no tmdbid', async () => {
            const retriever = new TmdbSeriesArtworkRetriever(makeOblecto({ tmdb: {} }));
            await assert.rejects(() => retriever.retrieveSeriesPoster({ tmdbid: null } as any), DebugExtendableError);
        });
    });

    describe('TvdbSeriesArtworkRetriever', () => {
        it('resolves an episode banner url from the cached filename', async () => {
            const oblecto = makeOblecto({ tvdb: { getEpisodeById: async () => ({ filename: 'ep.jpg' }) } });
            const retriever = new TvdbSeriesArtworkRetriever(oblecto);

            const urls = await retriever.retrieveEpisodeBanner({ tvdbid: 1 } as any);

            assert.deepEqual(urls, ['https://thetvdb.com/banners/_cache/ep.jpg']);
        });

        it('resolves series poster urls from all available posters', async () => {
            const oblecto = makeOblecto({ tvdb: { getSeriesPosters: async () => ([{ fileName: 'p1.jpg' }, { fileName: 'p2.jpg' }]) } });
            const retriever = new TvdbSeriesArtworkRetriever(oblecto);

            const urls = await retriever.retrieveSeriesPoster({ tvdbid: 1 } as any);

            assert.deepEqual(urls, ['http://thetvdb.com/banners/p1.jpg', 'http://thetvdb.com/banners/p2.jpg']);
        });

        it('throws when the series has no tvdbid', async () => {
            const retriever = new TvdbSeriesArtworkRetriever(makeOblecto({ tvdb: {} }));
            await assert.rejects(() => retriever.retrieveSeriesPoster({ tvdbid: null } as any), DebugExtendableError);
        });
    });

    describe('FanarttvSeriesArtworkRetriever', () => {
        it('always resolves an empty array for episode banners', async () => {
            const retriever = new FanarttvSeriesArtworkRetriever(makeOblecto());
            const urls = await retriever.retrieveEpisodeBanner({ id: 1 } as any);
            assert.deepEqual(urls, []);
        });

        it('throws when the series has no tvdbid', async () => {
            const retriever = new FanarttvSeriesArtworkRetriever(makeOblecto());
            await assert.rejects(() => retriever.retrieveSeriesPoster({ tvdbid: null } as any), DebugExtendableError);
        });
    });
});
