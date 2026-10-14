import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import type { MovieDb } from 'moviedb-promise';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { matchSeriesEpisodes } from '../../src/lib/series/episodeMatching.js';
import { SeriesExtras, catalogEpisodes, seriesCertifications } from '../../src/lib/series/SeriesExtras.js';
import { earlierEpisodes, buildEpisodeContext } from '../../src/submodules/REST/routes/helpers/episodeContext.js';
import { validatePreferences, resolvePreferences } from '../../src/lib/users/preferences.js';
import { seriesViewingProgress, episodeSpoilerState, tvProviderLinks, fileChapters } from '../../Oblecto-Web/src/utils/tvDetails.js';

describe('Series detail metadata cache', () => {
    let sequelize: Sequelize;
    beforeEach(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        await Series.sync({ force: true });
    });
    afterEach(async () => { await sequelize.close(); });

    const provider = (): Pick<MovieDb, 'tvVideos' | 'tvContentRatings' | 'tvInfo' | 'seasonInfo'> => ({
        tvVideos: async () => ({ results: [] }),
        tvContentRatings: async () => ({ results: [{ iso_3166_1: 'DE', rating: '12' }] }),
        tvInfo: async () => ({ seasons: [{ season_number: 1 }, { season_number: 2 }] }),
        seasonInfo: async params => ({ episodes: [{ id: Number(params.season_number) * 100, season_number: params.season_number, episode_number: 1, name: 'Pilot', air_date: '2026-10-01', runtime: 45 }] })
    });

    it('viewer extras neither fetch nor return the catalogue', async () => {
        const series = await Series.create({ tmdbid: 123 });
        const api = provider();
        api.tvInfo = api.seasonInfo = async () => { throw new Error('Viewer requested catalogue'); };
        const extras = await new SeriesExtras(api).get(series);
        assert.equal(extras.unavailable, false);
        assert.deepEqual(extras.certifications, [{ country: 'DE', certification: '12' }]);
        assert.equal('catalog' in extras, false);
        await series.reload();
        assert.equal(series.catalogUpdatedAt, null);
    });

    it('shares in-flight requests, stores the complete catalog and reuses it across service instances', async () => {
        const series = await Series.create({ tmdbid: 123, seriesName: 'Example' });
        const originalUpdatedAt = series.updatedAt.getTime();
        const api = provider();
        let calls = 0;
        const original = api.seasonInfo;
        api.seasonInfo = async (...args) => { calls++; return original(...args); };
        const service = new SeriesExtras(api);
        const [a, b] = await Promise.all([service.getCatalog(series), service.getCatalog(series)]);
        assert.deepEqual(a, b);
        assert.equal(a.catalog?.episodes.length, 2);
        assert.equal(a.unavailable, false);
        await series.reload();
        assert.equal(series.updatedAt.getTime(), originalUpdatedAt);
        assert.deepEqual(await new SeriesExtras(api).getCatalog(series), a);
        assert.equal(calls, 2);
    });

    it('preserves the complete catalog and timestamp if even one season fails', async () => {
        const old = new Date(Date.now() - 2 * 86400000);
        const catalog = { episodes: [{ tmdbid: 10, season: 1, number: 1, name: 'Original', airDate: null, runtime: null }] };
        const series = await Series.create({ tmdbid: 123, episodeCatalog: catalog, catalogUpdatedAt: old });
        const api = provider();
        const original = api.seasonInfo;
        api.seasonInfo = async (params, config) => {
            if (params.season_number === 2) throw new Error('offline');
            return original(params, config);
        };
        const result = await new SeriesExtras(api).getCatalog(series);
        assert.equal(result.unavailable, true);
        assert.deepEqual(result.catalog, catalog);
        await series.reload();
        assert.equal(series.catalogUpdatedAt?.getTime(), old.getTime());
        assert.equal(series.certificationsUpdatedAt, null);
    });

    it('refuses truncated or duplicate season snapshots instead of publishing false completeness', async () => {
        const api = provider();
        api.tvInfo = async () => ({ seasons: [{ season_number: 1, episode_count: 2 }] });
        const series = await Series.create({ tmdbid: 123 });
        const result = await new SeriesExtras(api).getCatalog(series);
        assert.equal(result.unavailable, true);
        assert.equal(result.catalog, null);
        api.tvInfo = async () => ({ seasons: [{ season_number: 1 }, { season_number: 1 }] });
        assert.equal((await new SeriesExtras(api).getCatalog(series)).unavailable, true);
    });

    it('rejects malformed catalogs and classifications and skips unidentified series', async () => {
        assert.throws(() => catalogEpisodes({ episodes: [{}] }, 1));
        assert.throws(() => catalogEpisodes({ episodes: [{ id: 1, season_number: 2, episode_number: 1, name: 'Wrong season' }] }, 1));
        assert.throws(() => seriesCertifications({ results: [{ iso_3166_1: 'xx', rating: '12' }] }));
        const series = await Series.create({ seriesName: 'Unidentified' });
        const fail = async (): Promise<never> => { throw new Error('Should not be called'); };
        const result = await new SeriesExtras({ tvVideos: fail, tvContentRatings: fail, tvInfo: fail, seasonInfo: fail }).getCatalog(series);
        assert.equal(result.catalog, null);
        assert.equal(result.unavailable, false);
    });
});

describe('TV navigation and presentation', () => {
    const episodes = [
        { id: 1, airedSeason: '1', airedEpisodeNumber: '1', runtime: 40, TrackEpisodes: [{ progress: 1 }], Files: [{ duration: 2400 }] },
        { id: 2, airedSeason: '1', airedEpisodeNumber: '2', runtime: 40, TrackEpisodes: [{ progress: 0.5, time: 1200 }], Files: [{ duration: 2400 }] },
        { id: 3, airedSeason: '2', airedEpisodeNumber: '1', runtime: 40, Files: [] },
        { id: 4, airedSeason: '0', airedEpisodeNumber: '1', runtime: 90, Files: [{ duration: 5400 }] },
        { id: 5, airedSeason: '10', airedEpisodeNumber: '1', runtime: null, Files: [{ id: 9 }] }
    ];
    it('keeps specials separate, sorts numerically, skips unavailable next episodes and scopes earlier episodes', () => {
        assert.deepEqual(earlierEpisodes(episodes, 5).map(row => row.id), [1, 2, 3]);
        assert.deepEqual(earlierEpisodes(episodes, 4), []);
        const context = buildEpisodeContext(episodes, 2);
        assert.equal((context?.next as { id: number }).id, 3);
        assert.equal((context?.nextUnwatched as { id: number }).id, 5);
        assert.deepEqual((context?.nearby as { id: number }[]).map(row => row.id), [1, 2]);
        assert.equal(buildEpisodeContext(episodes, 999), null);
    });
    it('distinguishes library progress from the complete catalog and flags unknown remaining runtime', () => {
        const progress = seriesViewingProgress(episodes, { episodes: [{ season: 1, number: 1 }, { season: 1, number: 2 }, { season: 2, number: 1 }, { season: 3, number: 1 }] });
        assert.equal(progress.total, 3);
        assert.equal(progress.watched, 1);
        assert.equal(progress.completedSeasons, 0);
        assert.equal(progress.remainingSeconds, 1200);
        assert.equal(progress.unknownRuntime, 1);
        assert.equal('expected' in progress, false);
    });
    it('validates spoiler preferences and reveals only watched or explicitly revealed details', () => {
        assert.equal(resolvePreferences({}).episodeSpoilers, 'off');
        assert.deepEqual(validatePreferences({ episodeSpoilers: 'hide-titles' }), {});
        assert.ok(validatePreferences({ episodeSpoilers: ['hide'] }).episodeSpoilers);
        const item = { episodeName: 'The killer revealed', overview: 'A spoiler', airedEpisodeNumber: 2, TrackEpisodes: [{ progress: 0.5 }] };
        assert.deepEqual(episodeSpoilerState(item, 'hide-titles'), { hidden: true, title: 'Episode 2', overview: '' });
        assert.equal(episodeSpoilerState(item, 'hide').title, item.episodeName);
        assert.equal(episodeSpoilerState(item, 'hide-titles', true).hidden, false);
        item.TrackEpisodes[0].progress = 0.9;
        assert.equal(episodeSpoilerState(item, 'hide-titles').hidden, false);
    });
    it('constructs safe episode links from the series TMDB id and keeps only playable chapter offsets', () => {
        assert.deepEqual(tvProviderLinks('episode', { tmdbid: 999 }), []);
        assert.equal(tvProviderLinks('episode', { Series: { tmdbid: 123 }, airedSeason: '0', airedEpisodeNumber: '2' })[0].url, 'https://www.themoviedb.org/tv/123/season/0/episode/2');
        assert.deepEqual(tvProviderLinks('episode', { tvdbid: 'javascript:alert(1)', imdbid: 'bad' }), []);
        assert.deepEqual(fileChapters({ duration: 100, chapters: [{ start: 20 }, { start: -1 }, { start: 100 }, { start: 0 }, { start: '5' }] }).map(chapter => chapter.start), [0, 20]);
    });
});


describe('Provider-independent episode matching', () => {
    const cached = (tmdbid: number, season = 1, number = 25, airDate: string | null = '2020-01-01') => ({ tmdbid, season, number, name: 'Example', airDate, runtime: 24 });
    const imported = (id: number, tmdbid: number | null, season = '2', number = '1') => ({ id, tmdbid, airedSeason: season, airedEpisodeNumber: number, Files: [{ id }] });

    it('matches all 24 anime episodes across S2E1–24 and S1E25–48 by ID', () => {
        const local = Array.from({ length: 24 }, (_, n) => imported(n + 1, 5892111 + n, '2', String(n + 1)));
        const catalog = { episodes: Array.from({ length: 24 }, (_, n) => cached(5892111 + n, 1, n + 25)) };
        const rows = matchSeriesEpisodes(local, catalog);
        assert.equal(rows.length, 24);
        assert.equal(rows.filter(row => row.status === 'matched').length, 24);
        assert.equal(rows[0].local?.airedSeason, '2');
        assert.equal(rows[0].catalog?.number, 25);
    });
    it('does not match conflicting identities just because numbering agrees', () => {
        const rows = matchSeriesEpisodes([imported(1, 11, '1', '1')], { episodes: [cached(22, 1, 1)] });
        assert.deepEqual(rows.map(row => row.status), ['review', 'review']);
        assert.equal(rows[0].catalog, null);
    });
    it('treats unknown IDs, duplicate IDs and unavailable catalogues as uncertain', () => {
        for (const local of [[imported(1, null)], [imported(1, 11), imported(2, 11)]]) {
            assert.ok(matchSeriesEpisodes(local, { episodes: [cached(11)] }).every(row => row.status === 'review'));
        }
        assert.ok(matchSeriesEpisodes([imported(1, 11)], { episodes: [cached(11), cached(11)] }).every(row => row.status === 'review'));
        assert.equal(matchSeriesEpisodes([imported(1, 11)], null)[0].reason, 'Catalogue unavailable');
    });
    it('keeps missing files, future dates, undated entries and specials distinct', () => {
        const rows = matchSeriesEpisodes([{ ...imported(1, 11), Files: [] }], { episodes: [
            cached(11), cached(12, 1, 26), cached(13, 1, 27, '2099-01-01'), cached(14, 1, 28, null), cached(15, 0, 1)
        ] }, '2026-10-10');
        assert.deepEqual(rows.filter(row => !row.special).map(row => row.status).sort(), ['absent', 'review', 'unscheduled', 'upcoming']);
        assert.equal(rows.find(row => row.local)?.reason, 'Matched ID, but no playable file');
        assert.equal(rows.filter(row => row.special).length, 1);
    });
});
