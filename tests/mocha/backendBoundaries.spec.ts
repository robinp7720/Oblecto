import assert from 'node:assert/strict';
import { TvdbAdapter, type RawTvdbClient } from '../../src/lib/common/TvdbAdapter.js';
import { decodeCursor, encodeCursor, parseBrowseParams } from '../../src/submodules/REST/routes/helpers/browse.js';
import { positiveId } from '../../src/submodules/REST/routes/helpers/input.js';

function provider(response: unknown): TvdbAdapter {
    const result = async () => response;
    const client: RawTvdbClient = {
        getEpisodeById: result, getEpisodesBySeriesId: result,
        getSeriesById: result, getSeriesByName: result, getSeriesPosters: result
    };
    return new TvdbAdapter(client);
}

describe('TVDB response boundary', () => {
    it('normalizes numeric strings and keeps only recognized, well-formed fields', async () => {
        assert.deepEqual(await provider({
            id: '42', episodeName: 'Pilot', airedSeason: '0', airedEpisodeNumber: 1,
            overview: {}, firstAired: null, absoluteNumber: '', dvdSeason: 'invalid', extra: 'ignored'
        }).getEpisodeById(42), { id: 42, episodeName: 'Pilot', airedSeason: 0, airedEpisodeNumber: 1 });
        assert.deepEqual(await provider([{ id: 2, seriesName: 'Example', siteRating: '8.5' }]).getSeriesByName('Example'),
            [{ id: 2, seriesName: 'Example', siteRating: 8.5 }]);
        assert.deepEqual(await provider([{ fileName: 'poster.jpg', extra: 1 }]).getSeriesPosters(2), [{ fileName: 'poster.jpg' }]);
    });

    it('rejects malformed entities, IDs, lists and artwork', async () => {
        for (const value of [null, [], 'bad', {}, { id: true }, { id: [1] }, { id: 0 }, { id: 1.5 }, { id: Number.MAX_SAFE_INTEGER + 1 }]) {
            await assert.rejects(provider(value).getEpisodeById(1), /Invalid TVDB/);
        }
        await assert.rejects(provider({ id: 1 }).getEpisodesBySeriesId(1), /Invalid TVDB list/);
        await assert.rejects(provider([{ id: 1 }, null]).getSeriesByName('Example'), /Invalid TVDB/);
        await assert.rejects(provider([{ fileName: 12 }]).getSeriesPosters(1), /Invalid TVDB image/);
    });

    it('preserves SDK failures for callers to classify and retry', async () => {
        const failure = new Error('provider unavailable');
        const client = provider(null);
        const raw: RawTvdbClient = {
            getEpisodeById: async () => { throw failure; },
            getEpisodesBySeriesId: async () => [], getSeriesById: async () => null,
            getSeriesByName: async () => [], getSeriesPosters: async () => []
        };
        await assert.rejects(new TvdbAdapter(raw).getEpisodeById(1), error => error === failure);
        await assert.rejects(client.getSeriesById(1), /Invalid TVDB response/);
    });
});

describe('Native request boundaries', () => {
    it('accepts positive IDs without coercing booleans, arrays or partial numbers', () => {
        for (const value of [1, '1', ' 42 ']) assert.equal(positiveId(value), Number(value));
        for (const value of [undefined, null, true, [], [1], {}, '', '1x', '1.5', 1.5, 0, -1, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            assert.throws(() => positiveId(value, 'setId'), /setId must be a positive integer/);
        }
    });

    it('validates browse parameters before query construction while preserving legacy pagination', () => {
        for (const field of ['count', 'page', 'yearFrom', 'yearTo', 'personId']) {
            for (const value of [true, ['1'], {}, '', '1x', '1.5', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
                assert.throws(() => parseBrowseParams({ mode: 'browse', [field]: value }), /whole number/);
            }
        }
        for (const field of ['q', 'libraryPath', 'cursor', 'order', 'watched', 'creditRole']) {
            assert.throws(() => parseBrowseParams({ mode: 'browse', [field]: ['value'] }), /must be a string/);
        }
        assert.throws(() => parseBrowseParams({ mode: 'browse', genre: ['Drama', 2] }), /genre/);
        const parsed = parseBrowseParams({ mode: 'browse', count: '200', page: '-1', personId: 2, genre: ['Drama,Comedy', 'Drama'] });
        assert.equal(parsed.count, 100);
        assert.equal(parsed.page, 0);
        assert.equal(parsed.personId, 2);
        assert.deepEqual(parsed.genres, ['Drama', 'Comedy']);
        assert.equal(parseBrowseParams({ count: '20ignored' }).count, 20);
    });

    it('validates cursor shape and binds it to filters, ordering and sort column', () => {
        const hash = parseBrowseParams({ mode: 'browse', genre: 'Drama' }).filterHash;
        for (const value of ['Title', 123, null]) {
            const cursor = encodeCursor('movieName', 'asc', value, 42, hash);
            assert.equal(decodeCursor(cursor, 'movieName', 'asc', hash).sortValue, value);
            assert.throws(() => decodeCursor(cursor, 'year', 'asc', hash), /current query/);
            assert.throws(() => decodeCursor(cursor, 'movieName', 'desc', hash), /current query/);
            assert.throws(() => decodeCursor(cursor, 'movieName', 'asc', 'different'), /current query/);
        }
        for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
            assert.throws(() => decodeCursor(encodeCursor('movieName', 'asc', 'A', id, hash), 'movieName', 'asc', hash), /invalid/);
        }
        for (const value of [undefined, {}, [], true]) {
            assert.throws(() => decodeCursor(encodeCursor('movieName', 'asc', value, 1, hash), 'movieName', 'asc', hash), /invalid/);
        }
        for (const cursor of ['garbage', 'x'.repeat(8193), Buffer.from('null').toString('base64'), Buffer.from('[]').toString('base64')]) {
            assert.throws(() => decodeCursor(cursor, 'movieName', 'asc', hash), /invalid/);
        }
    });
});
