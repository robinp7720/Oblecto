import assert from 'node:assert/strict';

import AggregateIdentifier from '../../src/lib/common/AggregateIdentifier.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import logger from '../../src/submodules/logger/index.js';

describe('AggregateIdentifier', function () {
    before(function () {
        logger.silent = true;
    });

    after(function () {
        logger.silent = false;
    });

    it('explains why each identifier failed', async function () {
        class TmdbMovieIdentifier {
            async identify(): Promise<Record<string, unknown>> { throw new Error('A promise has timed out'); }
        }
        class TvdbIdentifier {
            async identify(): Promise<Record<string, unknown>> { throw new IdentificationError('No results'); }
        }

        const identifier = new AggregateIdentifier();

        identifier.loadIdentifier(new TmdbMovieIdentifier() as never);
        identifier.loadIdentifier(new TvdbIdentifier() as never);

        await assert.rejects(
            identifier.identify('/media/Movies/a.mkv'),
            (e: Error) => e instanceof IdentificationError
                && e.message === 'Could not identify: /media/Movies/a.mkv (TmdbMovie: A promise has timed out; Tvdb: No results)'
        );
    });

    it('merges what the identifiers found', async function () {
        const identifier = new AggregateIdentifier();

        identifier.loadIdentifier({ identify: async () => ({ tmdbid: 1, overview: '' }) } as never);
        identifier.loadIdentifier({ identify: async () => ({ tvdbid: 2 }) } as never);

        assert.deepEqual(await identifier.identify('/media/TV/a.mkv'), { tmdbid: 1, tvdbid: 2 });
    });

    it('keeps useful values when later identifiers return missing or invalid metadata', async function () {
        const identifier = new AggregateIdentifier();

        identifier.loadIdentifier({ identify: async () => ({
            tmdbid: 1, overview: 'Synopsis', episodeName: 'Pilot', airedSeason: 1, runtime: 45
        }) });
        identifier.loadIdentifier({ identify: async () => ({
            tmdbid: undefined, overview: '', episodeName: '  ', airedSeason: null, runtime: NaN,
            tvdbid: 2, airedEpisodeNumber: 0, special: false
        }) });

        assert.deepEqual(await identifier.identify('/media/TV/a.mkv'), {
            tmdbid: 1, overview: 'Synopsis', episodeName: 'Pilot', airedSeason: 1, runtime: 45,
            tvdbid: 2, airedEpisodeNumber: 0, special: false
        });
    });

    it('lets later identifiers replace useful values with other useful values', async function () {
        const identifier = new AggregateIdentifier();

        identifier.loadIdentifier({ identify: async () => ({ episodeName: 'First', airedSeason: 1 }) });
        identifier.loadIdentifier({ identify: async () => ({ episodeName: 'Last', airedSeason: 0 }) });

        assert.deepEqual(await identifier.identify('/media/TV/a.mkv'), { episodeName: 'Last', airedSeason: 0 });
    });

    it('rejects identifications containing only missing or invalid values', async function () {
        const identifier = new AggregateIdentifier();

        identifier.loadIdentifier({ identify: async () => undefined });
        identifier.loadIdentifier({ identify: async () => ({
            tmdbid: undefined, tvdbid: null, episodeName: '  ', overview: '', runtime: Infinity
        }) });

        await assert.rejects(identifier.identify('/media/TV/a.mkv'), IdentificationError);
    });
});
