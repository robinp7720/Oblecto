import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import SeedboxController from '../../src/lib/seedbox/SeedboxController.js';
import type Seedbox from '../../src/lib/seedbox/Seedbox.js';
import type Oblecto from '../../src/lib/oblecto/index.js';

const controller = (): SeedboxController => new SeedboxController({
    config: { seedboxImport: { concurrency: 1 }, seedboxes: [] }
} as unknown as Oblecto);

describe('Seedbox lifecycle', () => {
    it('waits for startup discovery and accepted imports before closing driver connections', async () => {
        const seedboxes = controller();
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const events: string[] = [];
        seedboxes.importQueue.registerJob('testImport', async () => { events.push('import'); });
        seedboxes.importAllEpisodes = async () => {
            entered.resolve();
            await release.promise;
            seedboxes.importQueue.queueJob('testImport', null);
        };
        seedboxes.importAllMovies = async () => {};
        seedboxes.seedBoxes.push({ storageDriver: { close: async () => { events.push('driver'); } } } as unknown as Seedbox);
        const starting = seedboxes.loadAllSeedboxes();
        await entered.promise;
        let closed = false;
        const closing = seedboxes.close();
        assert.equal(seedboxes.close(), closing);
        void closing.then(() => { closed = true; });
        await setImmediate();
        assert.equal(closed, false);
        release.resolve();
        await Promise.all([starting, closing]);
        assert.deepEqual(events, ['import', 'driver']);
        assert.ok(seedboxes.importQueue.getStats().idle);
        await assert.rejects(seedboxes.loadAllSeedboxes(), /shutting down/);
    });

    it('closes every driver after one fails', async () => {
        const seedboxes = controller();
        const failed = new Error('Driver failed');
        let secondClosed = false;
        seedboxes.seedBoxes.push(
            { storageDriver: { close: () => { throw failed; } } } as unknown as Seedbox,
            { storageDriver: { close: async () => { secondClosed = true; } } } as unknown as Seedbox
        );
        await assert.rejects(seedboxes.close(), (error: unknown) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [failed]);
            return true;
        });
        assert.equal(secondClosed, true);
    });
});
