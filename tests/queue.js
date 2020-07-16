import Queue from '../src/lib/queue';

let queue = new Queue(2);
queue.addJob('identifySeries', async (job) => {
    console.log('Identifying series...');
});

console.log(queue.jobs);

queue.queueJob('identifySeries', {});

