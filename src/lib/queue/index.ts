import async from 'async';
import { JobTracker } from '../maintenance/JobTracker.js';
import logger from '../../submodules/logger/index.js';

export interface QueueItem {
    id: string;
    attr: unknown;
    maintenance?: ReturnType<JobTracker['current']>;
}

type Job = (attr: unknown) => Promise<void>;

export default class Queue {
    public maintenance = new JobTracker();
    private jobs: Partial<Record<string, Job>> = {};
    private queue: async.AsyncPriorityQueue<QueueItem>;

    /**
     * @param concurrency - Amount of tasks to handle simultaneously
     */
    constructor(concurrency: number) {
        this.queue = async.priorityQueue((job: QueueItem, callback: () => void) => {
            const run = this.jobs[job.id];

            if (!run) {
                this.maintenance.complete(job.maintenance, true);
                return callback();
            }

            const jobTimeout = setTimeout(() => {
                // logger.debug( `Job ${job.id} is taking a long time. Maybe something is wrong?`, JSON.stringify(job));
            }, 20000);

            Promise.resolve().then(() => this.maintenance.run(job.maintenance, () => run(job.attr)))
                .then(() => {
                    clearTimeout(jobTimeout);
                    this.maintenance.complete(job.maintenance, false);
                    callback();
                })
                .catch((err: unknown) => {
                    clearTimeout(jobTimeout);

                    const level = (err as { level?: unknown } | null)?.level;

                    if (typeof level === 'string' && level) {
                        logger.log(level, err);
                    } else {
                        logger.error(err);
                    }

                    this.maintenance.complete(job.maintenance, true);
                    callback();
                });
        }, concurrency);
    }

    /**
     *  Define a new job
     * @param id - ID/Name for job
     * @param job - Function used for Queue item
     */
    registerJob<T>(id: string, job: (attr: T) => Promise<void>): void {
        if (this.jobs[id]) {
            logger.error(`A job has been registered which was already registered: ${id}`);
            logger.error('This should not happen');
            return;
        }

        logger.debug('New queue item has been registered:', id);
        // Callers are trusted to queue attributes matching the job they registered
        this.jobs[id] = job as Job;
    }

    /**
     *  Add a job to the end of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     * @param priority - Priority for the job
     */
    queueJob(id: string, attr: unknown, priority: number = 5): void {
        const maintenance = this.maintenance.current();
        this.maintenance.enqueue(maintenance);
        void this.queue.push({ id, attr, maintenance }, priority);
    }

    /**
     *  Adds a queue which should be completed as soon as possible
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     */
    lowPriorityJob(id: string, attr: unknown): void {
        this.queueJob(id, attr, 20);
    }

    /**
     *  Add a job to the front of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed the job
     */
    pushJob(id: string, attr: unknown): void {
        this.queueJob(id, attr, 0);
    }

    /**
     * Snapshot of jobs waiting to run, in internal heap order rather than strict priority order
     * @param limit - Maximum number of jobs to return
     */
    pending(limit: number = Infinity): QueueItem[] {
        const items: QueueItem[] = [];

        for (const item of this.queue as unknown as Iterable<QueueItem>) {
            if (items.length >= limit) break;
            items.push(item);
        }

        return items;
    }

    /**
     * Get queue statistics
     */
    getStats(): { length: number; running: number; idle: boolean } {
        return {
            length: this.queue.length(),
            running: this.queue.running(),
            idle: this.queue.idle()
        };
    }
}
