import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { promises as fs } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { IConfig } from '../src/interfaces/config.js';
import { startupConfig } from './startupConfig.js';

const fixture = await startupConfig();
const occupied = createServer();
const cacheFailure = process.argv[2] === 'cache';
setTimeout(() => { console.error('Failed startup left resources open'); process.exit(1); }, 25000).unref();
try {
    await new Promise<void>(resolve => occupied.listen(0, resolve));
    const config = JSON.parse(await fs.readFile(fixture.file, 'utf8')) as IConfig;
    if (cacheFailure) config.streaming.cacheDirectory = fixture.file; // A file cannot be a cache directory.
    else config.server.port = (occupied.address() as AddressInfo).port;
    await fs.writeFile(fixture.file, JSON.stringify(config));
    process.env.OBLECTO_CONFIG_PATH = fixture.file;

    const { default: Oblecto } = await import('../src/lib/oblecto/index.js');
    const { progressEvents } = await import('../src/lib/playback/progress.js');
    const { favouriteEvents } = await import('../src/lib/users/favourites.js');
    const progressListeners = progressEvents.listenerCount('saved');
    const favouriteListeners = favouriteEvents.listenerCount('changed');
    const app = new Oblecto(config);

    await assert.rejects(app.start(), cacheFailure ? /EEXIST|ENOTDIR/ : /Could not listen on port .*EADDRINUSE/);
    if (cacheFailure) {
        // A rejected cache initialization also rejects playback cleanup. Other services must still
        // close, and repeated shutdown must retain that failure rather than retrying closed resources.
        const closing = app.close();
        assert.equal(app.close(), closing);
        await assert.rejects(closing, /Could not close playback/);
    } else {
        await app.close();
        await app.close();
    }
    assert.equal(app.oblectoAPI?.server.listening ?? false, false);
    assert.equal(app.embyServer?.serverAPI.server.listening ?? false, false);
    assert.ok(app.queue.getStats().idle);
    if (app.seedboxController) assert.ok(app.seedboxController.importQueue.getStats().idle);
    assert.equal(progressEvents.listenerCount('saved'), progressListeners);
    assert.equal(favouriteEvents.listenerCount('changed'), favouriteListeners);
    await assert.rejects(app.database.query('SELECT 1'), /closed/);
    console.log(`${cacheFailure ? 'Invalid cache directory' : 'Occupied REST port'} rejects startup and releases services, subscriptions and database`);
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await new Promise<void>(resolve => occupied.close(() => resolve()));
    await fixture.cleanup();
}
