import async from 'async';
import logger from '../../submodules/logger/index.js';

export default class Queue {
    private jobs: Record<string, (attr: any) => Promise<void>> = {};
    private queue: async.AsyncPriorityQueue<any>;

    /**
     * @param concurrency - Amount of tasks to handle simultaneously
     */
    constructor(concurrency: number) {
        this.queue = async.priorityQueue((job: any, callback: () => void) => {
            if (!this.jobs[job.id]) return callback();

            const jobTimeout = setTimeout(() => {
                // logger.debug( `Job ${job.id} is taking a long time. Maybe something is wrong?`, JSON.stringify(job));
            }, 20000);

            this.jobs[job.id](job.attr)
                .then(() => {
                    clearTimeout(jobTimeout);
                    callback();
                })
                .catch((err: any) => {
                    clearTimeout(jobTimeout);

                    if (err.level) {
                        logger.log(err.level, err);
                    } else {
                        logger.error(err);
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
    registerJob(id: string, job: (attr: any) => Promise<void>): void {
        if (this.jobs[id]) {
            logger.error( `A job has been registered which was already registered: ${id}`);
            logger.error( 'This should not happen');
            return;
        }

        logger.debug( 'New queue item has been registered:', id);
        this.jobs[id] = job;
    }

    /**
     *  Add a job to the end of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     * @param priority - Priority for the job
     */
    queueJob(id: string, attr: any, priority: number = 5): void {
        this.queue.push({ id, attr }, priority);
    }

    /**
     *  Adds a queue which should be completed as soon as possible
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     */
    lowPriorityJob(id: string, attr: any): void {
        this.queueJob(id, attr, 20);
    }

    /**
     *  Add a job to the front of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed the job
     */
    pushJob(id: string, attr: any): void {
        this.queueJob(id, attr, 0);
    }
}
