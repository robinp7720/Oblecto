import assert from 'node:assert/strict';
import { DataTypes, Sequelize } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import AggregateUpdateRetriever from '../../src/lib/common/AggregateUpdateRetriever.js';
import TmdbMovieRetriever from '../../src/lib/updaters/movies/informationRetrievers/TmdbMovieRetriever.js';
import TmdbSeriesRetriever from '../../src/lib/updaters/series/informationRetrievers/TmdbSeriesRetriever.js';
import { relatedTitles } from '../../src/submodules/REST/routes/helpers/related.js';
import { buildEpisodeContext } from '../../src/submodules/REST/routes/helpers/episodeContext.js';
import { libraryConnectionLabel, mediaCapabilities, nextSeriesEpisode, ratingLabel, relationshipLabel, seasonSummary } from '../../Oblecto-Web/src/utils/media.js';

async function merge(...responses: Record<string, unknown>[]) {
    const aggregate = new AggregateUpdateRetriever();
    for (const response of responses) aggregate.loadRetriever({ retrieveInformation: async () => response });
    return aggregate.retrieveInformation();
}

describe('Media metadata resilience', () => {
    it('preserves meaningful values across missing responses but accepts zero and false', async () => {
        assert.deepEqual(await merge(
            { title: 'First', overview: 'Synopsis', genre: '["Drama"]', runtime: 45, flag: true },
            { title: 'Last', overview: '  ', genre: '[]', runtime: null, flag: false, votes: 0, missing: undefined }
        ), { title: 'Last', overview: 'Synopsis', genre: '["Drama"]', runtime: 45, flag: false, votes: 0 });
    });
    it('replaces score, count and source as a single unit', async () => {
        assert.deepEqual(await merge(
            { siteRating: 8, siteRatingCount: 100, siteRatingSource: 'tmdb' },
            { siteRating: 7, siteRatingSource: 'tvdb' }
        ), { siteRating: 7, siteRatingCount: null, siteRatingSource: 'tvdb' });
        assert.deepEqual(await merge(
            { siteRating: 8, siteRatingCount: 100, siteRatingSource: 'tmdb' },
            { siteRating: null, siteRatingCount: 3, siteRatingSource: 'tvdb' }
        ), { siteRating: 8, siteRatingCount: 100, siteRatingSource: 'tmdb' });
    });
    it('rejects an entirely missing response', async () => {
        await assert.rejects(merge({ name: '', overview: null, genre: [] }));
    });
    it('retains movie metadata when credits fail or are malformed, and permits authoritative empty credits', async () => {
        for (const response of [new Error('offline'), {}, { cast: [null], crew: [] }, { cast: [], crew: [] }]) {
            const retriever = new TmdbMovieRetriever({ tmdb: {
                movieInfo: async () => ({ title: 'Arrival', genres: [], vote_average: 8 }),
                movieCredits: async () => { if (response instanceof Error) throw response; return response; }
            } } as never);
            const data = await retriever.retrieveInformation({ id: 1, tmdbid: 2 } as never);
            assert.equal(data.movieName, 'Arrival');
            assert.equal(data.siteRatingSource, 'tmdb');
            if ('cast' in response && Array.isArray(response.cast) && response.cast.length === 0) assert.deepEqual(data._credits, []);
            else assert.equal(data._credits, undefined);
        }
    });
    it('retains successful credits when core movie metadata fails', async () => {
        const retriever = new TmdbMovieRetriever({ tmdb: {
            movieInfo: async () => { throw new Error('offline'); },
            movieCredits: async () => ({ cast: [{ id: 3, name: 'Actor', character: 'Lead' }], crew: [] })
        } } as never);
        const aggregate = new AggregateUpdateRetriever();
        aggregate.loadRetriever(retriever as never);
        const data = await aggregate.retrieveInformation({ id: 1, tmdbid: 2 });
        assert.equal(data.movieName, undefined);
        assert.equal((data._credits as any[])[0].name, 'Actor');
    });

    it('preserves known creators when only aggregate series credits succeed', async () => {
        const retriever = new TmdbSeriesRetriever({ tmdb: {
            tvInfo: async () => { throw new Error('offline'); },
            tvAggregateCredits: async () => ({ cast: [], crew: [] })
        } } as never);
        const data = await retriever.retrieveInformation({ id: 1, tmdbid: 2, tvdbid: 3, imdbid: 'tt1' } as never);
        assert.deepEqual(data._credits, []);
        assert.equal(data._preserveCreators, true);
    });

    it('retains series metadata when credits and external IDs fail', async () => {
        const fail = async () => { throw new Error('offline'); };
        const retriever = new TmdbSeriesRetriever({ tmdb: {
            tvInfo: async () => ({ name: 'Show', genres: [], vote_average: 8 }),
            tvAggregateCredits: fail, tvExternalIds: fail
        } } as never);
        const data = await retriever.retrieveInformation({ id: 1, tmdbid: 2 } as never);
        assert.equal(data.seriesName, 'Show');
        assert.equal(data._credits, undefined);
    });
});

describe('Detail playback decisions', () => {
    const episode = (id: number, season: string, number: string, progress = 0, time = 0, updatedAt = '2026-01-01') => ({ id, airedSeason: season, airedEpisodeNumber: number, TrackEpisodes: [{ progress, time, updatedAt }] });
    it('resumes the latest unfinished regular episode and ignores specials', () => {
        const episodes = [episode(1, '1', '1', 0.4, 100), episode(2, '1', '2', 0.5, 200, '2026-02-01'), episode(3, '0', '1', 0.2, 30, '2026-03-01')];
        assert.equal(nextSeriesEpisode(episodes)?.episode.id, 2);
        assert.equal(nextSeriesEpisode(episodes)?.label, 'Resume S1 E2');
    });
    it('uses numeric order, skips completed episodes, and handles empty and completed libraries', () => {
        assert.equal(nextSeriesEpisode([episode(1, '1', '10'), episode(2, '1', '2'), episode(3, '1', '1', 0.9)])?.episode.id, 2);
        assert.equal(nextSeriesEpisode([episode(1, '1', '1', 1)])?.label, 'Watch again S1 E1');
        assert.equal(nextSeriesEpisode([]), null);
        assert.equal(nextSeriesEpisode([episode(1, '0', '1')])?.episode.id, 1);
    });
    it('does not invent rating provenance', () => {
        assert.equal(ratingLabel({ siteRating: 8 }), 'Community rating 8');
        assert.equal(ratingLabel({ siteRating: 8, siteRatingSource: 'tvdb' }), 'TVDB 8');
    });
    it('summarizes seasons, discovery relationships, connections and media streams', () => {
        const episodes = [
            { runtime: 40, siteRating: 8, TrackEpisodes: [{ progress: 1 }] },
            { runtime: 50, siteRating: 7, TrackEpisodes: [{ progress: 0.4 }] }
        ];
        assert.deepEqual(seasonSummary(episodes), { episodeCount: 2, watchedCount: 1, runtimeMinutes: 90, averageRating: 7.5 });
        assert.equal(relationshipLabel({ sharedPeople: [{ name: 'Actor' }, { name: 'Writer' }] }), 'With Actor +1');
        assert.equal(libraryConnectionLabel({ movies: 1, series: 2 }), 'Also in 1 movie and 2 shows');
        assert.deepEqual(mediaCapabilities([{ Streams: [
            { codec_type: 'video', width: 3840, color_transfer: 'smpte2084' },
            { codec_type: 'audio', channels: 6, tags_language: 'eng' },
            { codec_type: 'subtitle', tags_language: 'deu' }
        ] }]), ['4K', 'HDR10', '5.1 audio', 'Audio · ENG', 'Subtitles · DEU']);
    });
});

describe('Episode detail context', () => {
    const episode = (id: number, season: string, number: string, progress = 0) => ({
        id, airedSeason: season, airedEpisodeNumber: number, runtime: 45, siteRating: id + 5,
        TrackEpisodes: [{ progress }]
    });
    it('orders numeric episode numbers and crosses regular season boundaries', () => {
        const context = buildEpisodeContext([
            episode(3, '2', '1'), episode(2, '1', '10'), episode(1, '1', '2', 1), episode(4, '0', '1')
        ], 2) as any;
        assert.equal(context.previous.id, 1);
        assert.equal(context.next.id, 3);
        assert.deepEqual(context.season, { number: '1', position: 2, episodeCount: 2, watchedCount: 1, runtimeMinutes: 90, averageRating: 6.5 });
    });
    it('keeps specials in their own sequence', () => {
        const context = buildEpisodeContext([episode(1, '1', '1'), episode(2, '0', '1'), episode(3, '0', '2')], 2) as any;
        assert.equal(context.previous, null);
        assert.equal(context.next.id, 3);
    });
});

describe('Library related titles', () => {
    let db: Sequelize;
    beforeEach(async () => {
        db = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        for (const type of ['Movie', 'Series']) {
            const movie = type === 'Movie';
            db.define(type, { id: { type: DataTypes.INTEGER, primaryKey: true }, [movie ? 'movieName' : 'seriesName']: DataTypes.STRING, [movie ? 'genres' : 'genre']: DataTypes.STRING }, { timestamps: false, tableName: movie ? 'Movies' : 'Series' });
            db.define(`${type}Credit`, { [movie ? 'movieId' : 'seriesId']: DataTypes.INTEGER, personId: DataTypes.INTEGER }, { timestamps: false });
            db.define(`${type}Set`, { public: DataTypes.BOOLEAN, setName: DataTypes.STRING }, { timestamps: false });
            db.define(`${type}SetAllocation`, { [`${type}Id`]: DataTypes.INTEGER, [`${type}SetId`]: DataTypes.INTEGER }, { timestamps: false });
        }
        db.define('Person', { id: { type: DataTypes.INTEGER, primaryKey: true }, name: DataTypes.STRING }, { timestamps: false });
        await db.sync();
    });
    afterEach(async () => db.close());
    it('ranks visible collections before shared people and genres; hides private-only connections', async () => {
        await db.models.Series.bulkCreate([
            { id: 1, seriesName: 'Source', genre: '["Drama"]' },
            { id: 2, seriesName: 'Collection' }, { id: 3, seriesName: 'Person' },
            { id: 4, seriesName: 'Genre', genre: 'Comedy, Drama' }, { id: 5, seriesName: 'Private' }
        ]);
        await db.models.SeriesSet.bulkCreate([{ id: 1, public: true, setName: 'Public set' }, { id: 2, public: false, setName: 'Secret set' }]);
        await db.models.SeriesSetAllocation.bulkCreate([{ SeriesId: 1, SeriesSetId: 1 }, { SeriesId: 2, SeriesSetId: 1 }, { SeriesId: 1, SeriesSetId: 2 }, { SeriesId: 5, SeriesSetId: 2 }]);
        await db.models.Person.create({ id: 7, name: 'Shared person' });
        await db.models.SeriesCredit.bulkCreate([{ seriesId: 1, personId: 7 }, { seriesId: 3, personId: 7 }, { seriesId: 3, personId: 7 }]);
        const items = await relatedTitles(db, 'series', 1, '["Drama"]');
        assert.deepEqual(items.map(item => item.id), [2, 3, 4]);
        assert.equal(items[0]._collections, undefined);
        assert.deepEqual((items[0].relationship as any).sharedCollections, [{ id: 1, name: 'Public set' }]);
        assert.deepEqual((items[1].relationship as any).sharedPeople, [{ id: 7, name: 'Shared person' }]);
        assert.deepEqual((items[2].relationship as any).sharedGenres, ['Drama']);
    });
    it('excludes current and already shelved collection movies; caps results deterministically', async () => {
        await db.models.Movie.bulkCreate(Array.from({ length: 16 }, (_, id) => ({ id: id + 1, movieName: 'Same', genres: '["Drama"]' })));
        await db.models.MovieSet.create({ id: 1, public: true });
        await db.models.MovieSetAllocation.bulkCreate([{ MovieId: 1, MovieSetId: 1 }, { MovieId: 2, MovieSetId: 1 }]);
        const items = await relatedTitles(db, 'movie', 1, '["Drama"]');
        assert.deepEqual(items.map(item => item.id), Array.from({ length: 12 }, (_, id) => id + 3));
        assert.deepEqual(await relatedTitles(db, 'movie', 1, '["No match"]'), []);
    });
    it('treats genre wildcards and SQL punctuation as literal values', async () => {
        await db.models.Movie.bulkCreate([{ id: 1, movieName: 'Source' }, { id: 2, movieName: 'Match', genres: '["100%_fun"]' }, { id: 3, movieName: 'No', genres: '["100ABCfun"]' }]);
        assert.deepEqual((await relatedTitles(db, 'movie', 1, '["100%_fun"]')).map(item => item.id), [2]);
        assert.deepEqual(await relatedTitles(db, 'movie', 1, '["\\\" OR 1=1 --"]'), []);
    });
});

describe('Credit replacement', () => {
    it('deduplicates valid people, rejects zero IDs, and rolls back failed replacements', async () => {
        const { Person, personColumns } = await import('../../src/models/person.js');
        const { MovieCredit, movieCreditColumns } = await import('../../src/models/movieCredit.js');
        const { syncCredits } = await import('../../src/lib/updaters/common/CreditSync.js');
        const db = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        Person.init(personColumns, { sequelize: db, modelName: 'Person' });
        MovieCredit.init(movieCreditColumns, { sequelize: db, modelName: 'MovieCredit' });
        try {
            await db.sync();
            const credit = { tmdbid: 1, name: 'Actor', creditType: 'cast' as const, character: 'Lead' };
            await syncCredits('movie', 1, [credit, credit, { ...credit, tmdbid: 0 }]);
            assert.equal(await MovieCredit.count(), 1);
            assert.equal(await Person.count(), 1);
            MovieCredit.addHook('beforeCreate', 'fail-replacement', () => { throw new Error('Database failure'); });
            await assert.rejects(syncCredits('movie', 1, [{ ...credit, character: 'New role' }]), /Database failure/);
            assert.equal((await MovieCredit.findOne())?.character, 'Lead');
            MovieCredit.removeHook('beforeCreate', 'fail-replacement');
            await syncCredits('movie', 1, []);
            assert.equal(await MovieCredit.count(), 0);
            await syncCredits('movie', 1, [{ ...credit, creditType: 'crew', character: undefined, job: 'Creator' }, credit]);
            await syncCredits('movie', 1, [], true);
            assert.equal(await MovieCredit.count(), 1);
            assert.equal((await MovieCredit.findOne())?.job, 'Creator');
        } finally {
            MovieCredit.removeHook('beforeCreate', 'fail-replacement');
            await db.close();
        }
    });
});

describe('Series landscape artwork', () => {
    it('downloads TMDB backdrops to an isolated directory and queues configured sizes', async () => {
        const { mkdtemp, rm, access, writeFile } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const { join, dirname } = await import('node:path');
        const { default: ArtworkUtils } = await import('../../src/lib/artwork/ArtworkUtils.js');
        const { default: SeriesArtworkDownloader } = await import('../../src/lib/artwork/series/SeriesArtworkDownloader.js');
        const { default: SeriesArtworkCollector } = await import('../../src/lib/artwork/series/SeriesArtworkCollector.js');
        const { default: Downloader } = await import('../../src/lib/downloader/index.js');
        const root = await mkdtemp(join(tmpdir(), 'oblecto-fanart-'));
        const jobs: Array<{ name: string; payload: any }> = [];
        const oblecto: any = {
            config: { assets: { showFanartLocation: root }, artwork: { fanart: { small: 320, large: 1280 } }, 'fanart.tv': { key: '' } },
            tmdb: { tvImages: async () => ({ backdrops: [{ file_path: '/scene.jpg' }] }) },
            queue: { registerJob: () => {}, queueJob: (name: string, payload: any) => jobs.push({ name, payload }), pushJob: (name: string, payload: any) => jobs.push({ name, payload }) }
        };
        oblecto.artworkUtils = new ArtworkUtils(oblecto);
        const originalDownload = Downloader.attemptDownload;
        try {
            Downloader.attemptDownload = async (urls, path) => {
                assert.deepEqual(urls, ['https://image.tmdb.org/t/p/original/scene.jpg']);
                await access(dirname(path));
                await writeFile(path, 'fixture');
            };
            const series = { id: 1, tmdbid: 2 } as never;
            const collector = new SeriesArtworkCollector(oblecto);
            await collector.collectArtworkSeriesFanart(series);
            assert.equal(jobs.shift()?.name, 'downloadSeriesFanart');
            await new SeriesArtworkDownloader(oblecto).downloadSeriesFanart(series);
            assert.deepEqual(jobs.map(job => [job.name, job.payload.width]), [['rescaleImage', 320], ['rescaleImage', 1280]]);
            for (const job of jobs) await access(dirname(job.payload.to));
            jobs.length = 0;
            await collector.collectArtworkSeriesFanart(series);
            assert.equal(jobs.length, 0);
            oblecto.tmdb.tvImages = async () => ({ backdrops: [] });
            await new SeriesArtworkDownloader(oblecto).downloadSeriesFanart({ id: 3, tmdbid: 4 } as never);
            assert.equal(jobs.length, 0);
        } finally {
            Downloader.attemptDownload = originalDownload;
            await rm(root, { recursive: true, force: true });
        }
    });
});
