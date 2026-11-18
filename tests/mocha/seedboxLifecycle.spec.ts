import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
        seedboxes.importMovie = async () => { events.push('import'); };
        seedboxes.importAllEpisodes = async () => {
            entered.resolve();
            await release.promise;
            seedboxes.importQueue.queueJob('importMovie', { seedbox: seedboxes.seedBoxes[0], origin: 'fixture', destination: 'fixture' });
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

    for (const method of ['importMovie', 'importEpisode'] as const) {
        it(`indexes a successful retry after ${method} fails`, async () => {
            const directory = await mkdtemp(join(tmpdir(), 'seedbox-retry-'));
            const destination = join(directory, 'library', 'video.mkv');
            const events: string[] = [];
            const collected: string[] = [];
            const collector = { collectFile: (file: string) => collected.push(file) };
            const seedboxes = new SeedboxController({
                config: { seedboxImport: { concurrency: 1 } },
                movieCollector: collector, seriesCollector: collector,
                realTimeController: { broadcast: (_channel: string, message: { event: string }) => events.push(message.event) }
            } as unknown as Oblecto);
            const driver = { copy: async (_origin: string, _temporary: string) => { throw new Error('transfer interrupted'); } };
            const seedbox = { name: 'fixture', storageDriver: driver } as unknown as Seedbox;
            try {
                await assert.rejects(seedboxes[method](seedbox, 'video.mkv', destination), /transfer interrupted/);
                assert.deepEqual(events, ['import_start', 'import_error']);
                assert.deepEqual(collected, []);

                seedbox.storageDriver.copy = async (_origin, temporary) => { await writeFile(temporary, 'complete'); };
                await seedboxes[method](seedbox, 'video.mkv', destination);
                assert.equal(await readFile(destination, 'utf8'), 'complete');
                assert.deepEqual(events.slice(2), ['import_start', 'import_success']);
                assert.deepEqual(collected, [destination]);
            } finally {
                await seedboxes.close();
                await rm(directory, { recursive: true, force: true });
            }
        });
    }

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
