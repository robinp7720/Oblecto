import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { ServiceLifecycle } from '../../src/lib/oblecto/ServiceLifecycle.js';
import Queue from '../../src/lib/queue/index.js';

describe('Service lifecycle', () => {
    it('rolls back partial startup and preserves the startup error', async () => {
        const lifecycle = new ServiceLifecycle();
        const events: string[] = [];
        const failed = new Error('Listener failed');
        const starting = lifecycle.start(async () => {
            lifecycle.defer('database', 'database', () => { events.push('database'); });
            lifecycle.defer('timer', 'producers', () => { events.push('timer'); });
            throw failed;
        });
        await assert.rejects(starting, error => error === failed);
        await lifecycle.close();
        assert.deepEqual(events, ['timer', 'database']);
        await assert.rejects(lifecycle.start(async () => {}), /stopping or has stopped/);
    });

    it('finishes every cleanup phase after synchronous and asynchronous failures', async () => {
        const lifecycle = new ServiceLifecycle();
        const events: string[] = [];
        const syncFailure = new Error('Timer failed');
        const asyncFailure = new Error('Playback failed');
        await lifecycle.start(async () => {
            lifecycle.defer('database', 'database', () => { events.push('database'); });
            lifecycle.defer('statistics', 'persistence', () => { events.push('statistics'); });
            lifecycle.defer('HTTP', 'connections', () => { events.push('HTTP'); });
            lifecycle.defer('playback', 'playback', () => { events.push('playback'); return Promise.reject(asyncFailure); });
            lifecycle.defer('queue', 'jobs', () => { events.push('queue'); });
            lifecycle.defer('timer', 'producers', () => { events.push('timer'); throw syncFailure; });
            lifecycle.defer('intake', 'intake', () => { events.push('intake'); });
        });
        const closing = lifecycle.close();
        assert.equal(lifecycle.close(), closing);
        await assert.rejects(closing, (error: unknown) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual((error.errors as Error[]).map(failure => failure.cause), [syncFailure, asyncFailure]);
            return true;
        });
        assert.deepEqual(events, ['intake', 'timer', 'queue', 'playback', 'HTTP', 'statistics', 'database']);
    });

    it('retains startup and rollback failures together', async () => {
        const lifecycle = new ServiceLifecycle();
        const startup = new Error('Startup failed');
        const cleanup = new Error('Cleanup failed');
        await assert.rejects(lifecycle.start(async () => {
            lifecycle.defer('database', 'database', () => { throw cleanup; });
            throw startup;
        }), (error: unknown) => {
            assert.ok(error instanceof AggregateError);
            assert.equal(error.cause, startup);
            assert.equal(error.errors[0], startup);
            assert.equal((error.errors[1] as AggregateError).errors[0].cause, cleanup);
            return true;
        });
    });

    it('waits for startup during concurrent shutdown and closes late resources exactly once', async () => {
        const lifecycle = new ServiceLifecycle();
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const events: string[] = [];
        let starts = 0;
        const starting = lifecycle.start(async () => {
            starts++;
            lifecycle.defer('database', 'database', () => { events.push('database'); });
            entered.resolve();
            await release.promise;
            lifecycle.defer('listener', 'connections', () => { events.push('listener'); });
        });
        assert.equal(lifecycle.start(async () => { starts++; }), starting);
        await entered.promise;
        let closed = false;
        const closing = lifecycle.close();
        void closing.then(() => { closed = true; });
        await setImmediate();
        assert.equal(closed, false);
        release.resolve();
        await Promise.all([starting, closing]);
        await lifecycle.close();
        assert.equal(starts, 1);
        assert.deepEqual(events, ['listener', 'database']);
    });

    it('keeps the database open while an accepted job enqueues and finishes follow-up work', async () => {
        const lifecycle = new ServiceLifecycle();
        const queue = new Queue(1);
        const running = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const events: string[] = [];
        await lifecycle.start(async () => {
            lifecycle.defer('database', 'database', () => { events.push('database'); });
            lifecycle.defer('queue', 'jobs', () => queue.close());
            queue.registerJob('child', async () => { events.push('child'); });
            queue.registerJob('parent', async () => {
                running.resolve();
                await release.promise;
                events.push('parent');
                queue.queueJob('child', null);
            });
            queue.queueJob('parent', null);
        });
        await running.promise;
        const closing = lifecycle.close();
        await setImmediate();
        assert.deepEqual(events, []);
        release.resolve();
        await closing;
        assert.deepEqual(events, ['parent', 'child', 'database']);
    });
});
