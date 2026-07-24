import assert from 'node:assert/strict';
import AggregateIdentifier from '../../src/lib/common/AggregateIdentifier.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import logger from '../../src/submodules/logger/index.js';

describe('AggregateIdentifier', () => {
    before(() => { logger.silent = true; });
    after(() => { logger.silent = false; });

    it('merges results from multiple identifiers', async () => {
        const aggregate = new AggregateIdentifier();

        aggregate.loadIdentifier({ identify: async () => ({ tmdbid: 1 }) } as any);
        aggregate.loadIdentifier({ identify: async () => ({ tvdbid: 2 }) } as any);

        const result = await aggregate.identify('some/path.mkv');

        assert.deepEqual(result, { tmdbid: 1, tvdbid: 2 });
    });

    it('later identifiers overwrite earlier ones for the same key', async () => {
        const aggregate = new AggregateIdentifier();

        aggregate.loadIdentifier({ identify: async () => ({ seriesName: 'first' }) } as any);
        aggregate.loadIdentifier({ identify: async () => ({ seriesName: 'second' }) } as any);

        const result = await aggregate.identify('x');

        assert.equal(result.seriesName, 'second');
    });

    it('skips identifiers that throw and continues with the rest', async () => {
        const aggregate = new AggregateIdentifier();

        aggregate.loadIdentifier({ identify: async () => { throw new Error('boom'); } } as any);
        aggregate.loadIdentifier({ identify: async () => ({ tmdbid: 5 }) } as any);

        const result = await aggregate.identify('x');

        assert.deepEqual(result, { tmdbid: 5 });
    });

    it('strips empty string values from the merged result', async () => {
        const aggregate = new AggregateIdentifier();

        aggregate.loadIdentifier({ identify: async () => ({ imdbid: '', tmdbid: 3 }) } as any);

        const result = await aggregate.identify('x');

        assert.deepEqual(result, { tmdbid: 3 });
    });

    it('throws IdentificationError when no identifier produces any data', async () => {
        const aggregate = new AggregateIdentifier();

        aggregate.loadIdentifier({ identify: async () => { throw new Error('boom'); } } as any);
        aggregate.loadIdentifier({ identify: async () => ({}) } as any);

        await assert.rejects(() => aggregate.identify('x'), IdentificationError);
    });

    it('throws IdentificationError when no identifiers are loaded', async () => {
        const aggregate = new AggregateIdentifier();

        await assert.rejects(() => aggregate.identify('x'), IdentificationError);
    });

    it('passes all arguments through to each identifier', async () => {
        const received: unknown[][] = [];
        const aggregate = new AggregateIdentifier();

        aggregate.loadIdentifier({
            identify: async (...args: unknown[]) => {
                received.push(args);
                return { tmdbid: 1 };
            }
        } as any);

        await aggregate.identify('path', { season: 1 }, { seriesName: 'x' });

        assert.deepEqual(received[0], ['path', { season: 1 }, { seriesName: 'x' }]);
    });
});
