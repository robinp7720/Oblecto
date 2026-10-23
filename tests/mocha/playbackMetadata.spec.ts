import assert from 'node:assert/strict';
import { MetadataCache, waitFor } from '../../src/lib/playback/metadataCache.js';

describe('Shared playback metadata', () => {
    it('shares in-flight loads while allowing one waiter to cancel independently', async () => {
        const cache = new MetadataCache<number[]>();
        const gate = Promise.withResolvers<number[]>();
        let calls = 0;
        const load = () => { calls++; return gate.promise; };
        const first = new AbortController();
        const second = new AbortController();
        const cancelled = waitFor(cache.get('same-file-version', load), first.signal);
        const survivor = waitFor(cache.get('same-file-version', load), second.signal);
        first.abort();
        await assert.rejects(cancelled, /cancelled/);
        gate.resolve([0, 4, 8]);
        assert.deepEqual(await survivor, [0, 4, 8]);
        assert.equal(calls, 1);
        assert.deepEqual(await cache.get('same-file-version', load), [0, 4, 8]);
        assert.equal(calls, 1);
    });

    it('retries failed scans, distinguishes file versions, and bounds retained metadata', async () => {
        const cache = new MetadataCache<number>(2);
        let calls = 0;
        const load = () => Promise.resolve(++calls);
        await assert.rejects(cache.get('v1', () => Promise.reject(new Error('temporary failure'))));
        assert.equal(await cache.get('v1', load), 1);
        assert.equal(await cache.get('v2', load), 2);
        assert.equal(await cache.get('v1', load), 1);
        assert.equal(await cache.get('v3', load), 3);
        assert.equal(await cache.get('v2', load), 4);
    });
});
