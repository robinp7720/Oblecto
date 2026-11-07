import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import Queue from '../../src/lib/queue/index.js';

describe('Queue shutdown', () => {
    it('closes an idle queue and rejects every external submission path', async () => {
        const queue = new Queue<{ job: null; record: string; parent: null; child: null; failed: null }>(1);
        const closing = queue.close();
        assert.equal(queue.close(), closing);
        await closing;
        assert.throws(() => queue.queueJob('job', null), /shutting down/);
        assert.throws(() => queue.pushJob('job', null), /shutting down/);
        assert.throws(() => queue.lowPriorityJob('job', null), /shutting down/);
        assert.throws(() => queue.maintenance.start('scan', 'all', async () => {}), /shutting down/);
    });

    it('waits for running, queued and descendant jobs while rejecting external submissions', async () => {
        const queue = new Queue<{ job: null; record: string; parent: null; child: null; failed: null }>(1);
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const events: string[] = [];
        queue.registerJob('record', async (name: string) => { events.push(name); });
        queue.registerJob('parent', async () => {
            entered.resolve();
            await release.promise;
            queue.queueJob('record', 'child');
        });
        queue.queueJob('parent', null);
        queue.queueJob('record', 'queued');
        await entered.promise;
        let closed = false;
        const closing = queue.close().then(() => { closed = true; });
        assert.throws(() => queue.queueJob('record', 'external'), /shutting down/);
        await setImmediate();
        assert.equal(closed, false);
        release.resolve();
        await closing;
        assert.deepEqual(events, ['queued', 'child']);
        assert.deepEqual(queue.getStats(), { length: 0, running: 0, idle: true });
    });

    it('waits for discovery that has not enqueued anything yet and completes maintenance tracking', async () => {
        const queue = new Queue<{ job: null; record: string; parent: null; child: null; failed: null }>(1);
        const release = Promise.withResolvers<void>();
        let executed = 0;
        queue.registerJob('child', async () => { executed++; });
        queue.registerJob('parent', async () => { queue.queueJob('child', null); });
        queue.maintenance.start('scan', 'all', async () => {
            await release.promise;
            queue.queueJob('parent', null);
        });
        let closed = false;
        const closing = queue.close().then(() => { closed = true; });
        await setImmediate();
        assert.equal(closed, false);
        release.resolve();
        await closing;
        assert.equal(executed, 1);
        const [job] = queue.maintenance.list();
        assert.equal(job.state, 'completed');
        assert.equal(job.discovering, false);
        assert.equal(job.total, 2);
        assert.equal(job.completed, 2);
    });

    it('settles after job and discovery failures without losing maintenance counts', async () => {
        const queue = new Queue<{ job: null; record: string; parent: null; child: null; failed: null }>(1);
        queue.registerJob('failed', () => { throw new Error('Expected job failure'); });
        queue.maintenance.start('scan', 'all', async () => {
            queue.queueJob('failed', null);
            throw new Error('Expected discovery failure');
        });
        await queue.close();
        const [job] = queue.maintenance.list();
        assert.equal(job.state, 'failed');
        assert.equal(job.total, 2);
        assert.equal(job.failed, 2);
        assert.ok(queue.getStats().idle);
    });

    it('does not admit detached work through a finished job context', async () => {
        const queue = new Queue<{ job: null; record: string; parent: null; child: null; failed: null }>(1);
        const release = Promise.withResolvers<void>();
        let detached!: Promise<void>;
        queue.registerJob('parent', async () => {
            detached = release.promise.then(() => {
                assert.throws(() => queue.queueJob('parent', null), /shutting down/);
            });
        });
        queue.queueJob('parent', null);
        await queue.close();
        release.resolve();
        await detached;
    });
});
