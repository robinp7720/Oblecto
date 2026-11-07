import type Queue from '../src/lib/queue/index.js';
import type { BackendJobs } from '../src/lib/queue/jobs.js';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { startupConfig } from './startupConfig.js';

const config = await startupConfig();
process.env.OBLECTO_CONFIG_PATH = config.file;
setTimeout(() => { console.error('TUI startup/shutdown left resources open'); process.exit(1); }, 25000).unref();
try {
    const { default: core } = await import('../src/core/graphical.js');
    await core.start();
    assert.ok(core.oblecto);
    const running = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const events: string[] = [];
    const app = core.oblecto;
    const queue = app.queue as Queue<BackendJobs & { shutdownChild: null; shutdownParent: null }>;
    queue.registerJob('shutdownChild', async () => {
        await app.database.query('SELECT 1');
        events.push('child');
    });
    queue.registerJob('shutdownParent', async () => {
        running.resolve();
        await release.promise;
        await app.database.query('SELECT 1');
        events.push('parent');
        queue.queueJob('shutdownChild', null);
    });
    queue.queueJob('shutdownParent', null);
    await running.promise;
    let closed = false;
    const closing = core.close().then(() => { closed = true; });
    await setImmediate();
    assert.equal(closed, false);
    release.resolve();
    await closing;
    assert.deepEqual(events, ['parent', 'child']);
    assert.ok(app.queue.getStats().idle);
    await assert.rejects(app.database.query('SELECT 1'), /closed/);
    assert.equal(core.oblecto.playback.sessions.size, 0);
    console.log('TUI starts, drains active jobs and descendants, and closes the database last');
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await config.cleanup();
}
