/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-misused-promises */
import Queue from '../src/lib/queue/index.js';

const queue = new Queue(2);

queue.registerJob('identifySeries', async (job: unknown) => {
    void job;
    console.log('Identifying series...');
});

console.log(queue.jobs);

queue.queueJob('identifySeries', {});
