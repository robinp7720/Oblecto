import async from 'async';
import type { BackendJobs } from './jobs.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { JobTracker } from '../maintenance/JobTracker.js';
import logger from '../../submodules/logger/index.js';

export interface QueueItem {
    id: string;
    attr: unknown;
    maintenance?: ReturnType<JobTracker['current']>;
}

type Job = (attr: unknown) => Promise<void>;

type Arguments<Jobs> = { [K in keyof Jobs & string]: [id: K, attr: Jobs[K], priority?: number] }[keyof Jobs & string];
type ImmediateArguments<Jobs> = { [K in keyof Jobs & string]: [id: K, attr: Jobs[K]] }[keyof Jobs & string];

export default class Queue<Jobs extends object = BackendJobs> {
    public maintenance = new JobTracker();
    private jobs = new Map<string, Job>();
    private queue: async.AsyncPriorityQueue<QueueItem>;
    private execution = new AsyncLocalStorage<{ active: boolean }>();
    private closing?: Promise<void>;
    private accepting = true;

    /**
     * @param concurrency - Amount of tasks to handle simultaneously
     */
    constructor(concurrency: number) {
        this.queue = async.priorityQueue((job: QueueItem, callback: () => void) => {
            const run = this.jobs.get(job.id);

            if (!run) {
                this.maintenance.complete(job.maintenance, true);
                return callback();
            }

            const execution = { active: true };
            Promise.resolve().then(() => this.execution.run(execution, () => this.maintenance.run(job.maintenance, () => run(job.attr))))
                .then(() => {
                    execution.active = false;
                    this.maintenance.complete(job.maintenance, false);
                    callback();
                })
                .catch((err: unknown) => {
                    execution.active = false;
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
    registerJob<K extends keyof Jobs & string>(id: K, job: (attr: Jobs[K]) => Promise<void>): void {
        if (this.jobs.has(id)) throw new Error(`Job already registered: ${id}`);
        logger.debug('New queue item has been registered:', id);
        // Type erasure is confined to storage; every public producer is checked against Jobs.
        this.jobs.set(id, attr => job(attr as Jobs[K]));
    }

    /**
     *  Add a job to the end of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     * @param priority - Priority for the job
     */
    queueJob(...[id, attr, priority = 5]: Arguments<Jobs>): void {
        // Accepted jobs and in-flight discovery may enqueue descendants while draining. A stale
        // async context (for example a detached timer after its job finished) grants no admission.
        if (!this.accepting && !this.execution.getStore()?.active && !this.maintenance.current()?.job.discovering)
            throw new Error('Queue is shutting down');
        if (!this.jobs.has(id)) throw new Error(`Job is not registered: ${id}`);
        const maintenance = this.maintenance.current();
        this.maintenance.enqueue(maintenance);
        void this.queue.push({
            id, attr, maintenance
        }, priority);
    }

    /**
     *  Adds a queue which should be completed as soon as possible
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed to the job
     */
    lowPriorityJob(...args: ImmediateArguments<Jobs>): void {
        this.queueJob(...[...args, 20] as Arguments<Jobs>);
    }

    /**
     *  Add a job to the front of the queue
     * @param id - Id for the job to be called
     * @param attr - Attributes to be passed the job
     */
    pushJob(...args: ImmediateArguments<Jobs>): void {
        this.queueJob(...[...args, 0] as Arguments<Jobs>);
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

    /** Reject new work and wait for discovery, queued jobs, and their descendants to finish. */
    close(): Promise<void> {
        this.accepting = false;
        this.closing ??= (async () => {
            await this.maintenance.close();
            if (!this.queue.idle()) await this.queue.drain();
        })();
        return this.closing;
    }
}
