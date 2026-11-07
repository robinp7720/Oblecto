

import assert from 'node:assert/strict';
import Queue from '../../src/lib/queue/index.js';
import logger from '../../src/submodules/logger/index.js';

describe('Queue', function () {
    type Jobs = { toString: object; constructor: object; __proto__: object; finished: object; duplicateJob: object;
        execJob: { foo: string }; concurrencyJob: object; priorityJob: { name: string }; blocker: object; errorJob: { shouldFail: boolean }; statsJob: object };
    let queue: Queue<Jobs>;

    before(function () {
        logger.silent = true;
    });

    after(function () {
        logger.silent = false;
    });

    beforeEach(function () {
        queue = new Queue<Jobs>(1);
    });

    it('should register and execute job names inherited by plain objects', async function () {
        const names = ['toString', 'constructor', '__proto__'] as const;
        const executed: string[] = [];
        const finished = Promise.withResolvers<void>();

        for (const name of names) {
            queue.registerJob(name, async () => { executed.push(name); });
            queue.queueJob(name, {});
        }
        queue.registerJob('finished', async () => { finished.resolve(); });
        queue.queueJob('finished', {});

        await finished.promise;
        assert.deepEqual(executed, names);
    });

    it('rejects duplicate and unregistered jobs before counting maintenance work', async () => {
        queue.registerJob('duplicateJob', async () => {});
        assert.throws(() => queue.registerJob('duplicateJob', async () => {}), /already registered/);
        assert.throws(() => queue.queueJob('execJob', { foo: 'bar' }), /not registered/);
        assert.equal(queue.getStats().length, 0);
        await queue.close();
    });

    it('should execute a queued job', function (done) {
        const jobName = 'execJob';
        queue.registerJob(jobName, async (attr) => {
            try {
                assert.deepEqual(attr, { foo: 'bar' });
                done();
            } catch (e) {
                done(e);
            }
        });

        queue.queueJob(jobName, { foo: 'bar' });
    });

    it('should respect concurrency', function (done) {
        queue = new Queue<Jobs>(1);
        const jobName = 'concurrencyJob';
        let running = 0;
        let maxRunning = 0;
        let completed = 0;

        queue.registerJob(jobName, async () => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise(resolve => setTimeout(resolve, 50));
            running--;
            completed++;
            if (completed === 2) {
                try {
                    assert.equal(maxRunning, 1);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        queue.queueJob(jobName, {});
        queue.queueJob(jobName, {});
    });

    it('should respect priority', function (done) {
        queue = new Queue<Jobs>(1); // Concurrency 1 to force queuing
        const jobName = 'priorityJob';
        const order: string[] = [];

        // Pause the queue or block it with a long running task first
        queue.registerJob('blocker', async () => {
             await new Promise(resolve => setTimeout(resolve, 50));
        });

        queue.registerJob(jobName, async (attr: { name: string }) => {
            order.push(attr.name);
            if (order.length === 2) {
                try {
                    assert.equal(order[0], 'high');
                    assert.equal(order[1], 'low');
                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        // Start blocker
        queue.queueJob('blocker', {});

        // Add low priority first
        queue.lowPriorityJob(jobName, { name: 'low' });
        // Add high priority second
        queue.pushJob(jobName, { name: 'high' });
    });

    it('should handle job errors gracefully', function (done) {
        const jobName = 'errorJob';
        let calls = 0;

        queue.registerJob(jobName, async (attr: { shouldFail: boolean }) => {
            calls++;
            if (attr.shouldFail) {
                throw new Error('Intentional error');
            }
            // If we get here for the second job, it means queue didn't crash
            if (calls === 2) {
                done();
            }
        });

        queue.queueJob(jobName, { shouldFail: true });
        queue.queueJob(jobName, { shouldFail: false });
    });

    it('should return correct stats', function (done) {
         queue = new Queue<Jobs>(1);
         const jobName = 'statsJob';

         queue.registerJob(jobName, async () => {
             const stats = queue.getStats();
             try {
                assert.equal(stats.running, 1);
                // length might be 1 if the second job is already pushed but not picked up?
                // async.queue length is waiting tasks.
             } catch (e) {
                 done(e);
             }
             await new Promise(resolve => setTimeout(resolve, 20));
         });

         queue.queueJob(jobName, {});
         queue.queueJob(jobName, {});

         // Immediate check
         // Depending on async.queue implementation, it might pick up first task immediately.
         // Let's just wait for completion.

         const checkStats = setInterval(() => {
             const stats = queue.getStats();
             if (stats.length === 1 && stats.running === 1) {
                 clearInterval(checkStats);
                 done();
             }
         }, 5);
    });
});
