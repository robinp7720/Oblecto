import Queue from '../src/lib/queue/index.js';

const queue = new Queue(2);

queue.registerJob('identifySeries', async (job: unknown) => {
    void job;
    console.log('Identifying series...');
});

console.log(queue.jobs);

queue.queueJob('identifySeries', {});
