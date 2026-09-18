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
});
