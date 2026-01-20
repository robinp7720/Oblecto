import async from 'async';
import logger from '../../submodules/logger/index.js';

interface QueueItem {
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attr: any;
}

export default class Queue {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private jobs: Record<string, (attr: any) => Promise<void>> = {};
    private queue: async.AsyncPriorityQueue<QueueItem>;

    /**
     * @param concurrency - Amount of tasks to handle simultaneously
     */
    constructor(concurrency: number) {
        this.queue = async.priorityQueue((job: QueueItem, callback: () => void) => {
            if (!this.jobs[job.id]) return callback();

            const jobTimeout = setTimeout(() => {
                // logger.debug( `Job ${job.id} is taking a long time. Maybe something is wrong?`, JSON.stringify(job));
            }, 20000);

            this.jobs[job.id](job.attr)
                .then(() => {
                    clearTimeout(jobTimeout);
                    callback();
                })
                .catch((err: unknown) => {
                    clearTimeout(jobTimeout);

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const error = err as any;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions
                    if (error.level) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                        logger.log(error.level, error);
                    } else {
                        logger.error(error);
                    }

                    callback();
                });
        }, concurrency);
    }

    /**
     *  Define a new job
     * @param id - ID/Name for job
     * @param job - Function used for Queue item
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerJob(id: string, job: (attr: any) => Promise<void>): void {
        if (this.jobs[id]) {
            logger.error(`A job has been registered which was already registered: ${id}`);
            logger.error('This should not happen');
            return;
        }

        logger.debug('New queue item has been registered:', id);
        this.jobs[id] = job;
    }

    /**
     *  Add a job to the end of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     * @param priority - Priority for the job
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queueJob(id: string, attr: any, priority: number = 5): void {
        void this.queue.push({ id, attr }, priority);
    }

    /**
     *  Adds a queue which should be completed as soon as possible
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lowPriorityJob(id: string, attr: any): void {
        this.queueJob(id, attr, 20);
    }

    /**
     *  Add a job to the front of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed the job
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pushJob(id: string, attr: any): void {
        this.queueJob(id, attr, 0);
    }
}
