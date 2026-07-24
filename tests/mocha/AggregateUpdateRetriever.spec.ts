import assert from 'node:assert/strict';
import AggregateUpdateRetriever from '../../src/lib/common/AggregateUpdateRetriever.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import logger from '../../src/submodules/logger/index.js';

describe('AggregateUpdateRetriever', () => {
    before(() => { logger.silent = true; });
    after(() => { logger.silent = false; });

    it('merges information from multiple retrievers', async () => {
        const aggregate = new AggregateUpdateRetriever();

        aggregate.loadRetriever({ retrieveInformation: async () => ({ title: 'Movie' }) } as any);
        aggregate.loadRetriever({ retrieveInformation: async () => ({ overview: 'A story' }) } as any);

        const result = await aggregate.retrieveInformation(123);

        assert.deepEqual(result, { title: 'Movie', overview: 'A story' });
    });

    it('later retrievers overwrite earlier ones for the same key', async () => {
        const aggregate = new AggregateUpdateRetriever();

        aggregate.loadRetriever({ retrieveInformation: async () => ({ title: 'first' }) } as any);
        aggregate.loadRetriever({ retrieveInformation: async () => ({ title: 'second' }) } as any);

        const result = await aggregate.retrieveInformation(1);

        assert.equal(result.title, 'second');
    });

    it('skips retrievers that throw and continues with the rest', async () => {
        const aggregate = new AggregateUpdateRetriever();

        aggregate.loadRetriever({ retrieveInformation: async () => { throw new Error('boom'); } } as any);
        aggregate.loadRetriever({ retrieveInformation: async () => ({ title: 'ok' }) } as any);

        const result = await aggregate.retrieveInformation(1);

        assert.deepEqual(result, { title: 'ok' });
    });

    it('strips empty string values from the merged result', async () => {
        const aggregate = new AggregateUpdateRetriever();

        aggregate.loadRetriever({ retrieveInformation: async () => ({ imdbid: '', title: 'ok' }) } as any);

        const result = await aggregate.retrieveInformation(1);

        assert.deepEqual(result, { title: 'ok' });
    });

    it('throws IdentificationError when no retriever produces any data', async () => {
        const aggregate = new AggregateUpdateRetriever();

        aggregate.loadRetriever({ retrieveInformation: async () => { throw new Error('boom'); } } as any);

        await assert.rejects(() => aggregate.retrieveInformation(1), IdentificationError);
    });

    it('throws IdentificationError when no retrievers are loaded', async () => {
        const aggregate = new AggregateUpdateRetriever();

        await assert.rejects(() => aggregate.retrieveInformation(1), IdentificationError);
    });
});
