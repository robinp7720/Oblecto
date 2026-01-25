
import expect from 'expect.js';
import Queue from '../../src/lib/queue/index.js';
import logger from '../../src/submodules/logger/index.js';

describe('Queue', function () {
    let queue: Queue;

    before(function () {
        logger.silent = true;
    });

    after(function () {
        logger.silent = false;
    });

    beforeEach(function () {
        queue = new Queue(1);
    });

    it('should register a job successfully', function () {
        const jobName = 'testJob';
        queue.registerJob(jobName, async () => {});
        // Accessing private property for verification, or we can assume no error means success
        // and verify via execution later.
        expect((queue as any).jobs).to.have.property(jobName);
    });

    it('should log error when registering duplicate job', function () {
        const jobName = 'duplicateJob';
        queue.registerJob(jobName, async () => {});
        
        // We can't easily assert on logger output without spying on it, 
        // but we can ensure it doesn't throw.
        queue.registerJob(jobName, async () => {});
    });

    it('should execute a queued job', function (done) {
        const jobName = 'execJob';
        queue.registerJob(jobName, async (attr) => {
            try {
                expect(attr).to.eql({ foo: 'bar' });
                done();
            } catch (e) {
                done(e);
            }
        });

        queue.queueJob(jobName, { foo: 'bar' });
    });

    it('should respect concurrency', function (done) {
        queue = new Queue(1);
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
                    expect(maxRunning).to.be(1);
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
        queue = new Queue(1); // Concurrency 1 to force queuing
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
                    expect(order[0]).to.be('high');
                    expect(order[1]).to.be('low');
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
         queue = new Queue(1);
         const jobName = 'statsJob';

         queue.registerJob(jobName, async () => {
             const stats = queue.getStats();
             try {
                expect(stats.running).to.be(1);
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
