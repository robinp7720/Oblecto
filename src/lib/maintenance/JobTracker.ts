import { AsyncLocalStorage } from 'node:async_hooks';
import logger from '../../submodules/logger/index.js';
import { randomUUID } from 'node:crypto';

export interface MaintenanceJob {
    id: string;
    action: string;
    target: string;
    state: 'queued' | 'running' | 'completed' | 'failed';
    createdAt: string;
    finishedAt?: string;
    discovering: boolean;
    total: number;
    completed: number;
    failed: number;
    error?: string;
}
interface Tracked { job: MaintenanceJob; pending: number }

/** Async context follows queue descendants without changing domain job payloads. */
export class JobTracker {
    private context = new AsyncLocalStorage<Tracked | undefined>();
    private jobs: Tracked[] = [];
    private discoveries = new Set<Promise<void>>();
    private closing = false;

    current(): Tracked | undefined { return this.context.getStore(); }
    run<T>(tracked: Tracked | undefined, work: () => T): T { return this.context.run(tracked, work); }

    start(action: string, target: string, work: () => Promise<void>): MaintenanceJob {
        if (this.closing) throw new Error('Maintenance is shutting down');
        const existing = this.jobs.find(({ job }) => job.action === action && job.target === target && job.finishedAt === undefined);
        if (existing) return { ...existing.job };
        const tracked: Tracked = {
            pending: 1,
            job: {
                id: randomUUID(),
                action,
                target,
                state: 'queued',
                createdAt: new Date().toISOString(),
                discovering: true,
                total: 0,
                completed: 0,
                failed: 0
            }
        };
        this.jobs.unshift(tracked);
        const discovery = Promise.resolve().then(() => this.run(tracked, async () => {
            tracked.job.state = 'running';
            try {
                await work();
            } catch (error) {
                logger.error(error);
                tracked.job.total++;
                this.fail(tracked, 'Some maintenance work failed. Check the server logs or problem files for details.');
            } finally {
                tracked.job.discovering = false;
                this.finish(tracked);
            }
        }));
        this.discoveries.add(discovery);
        void discovery.finally(() => this.discoveries.delete(discovery));
        return { ...tracked.job };
    }

    enqueue(tracked = this.current()): void {
        if (!tracked) return;
        tracked.pending++;
        tracked.job.total++;
    }
    complete(tracked: Tracked | undefined, failed: boolean): void {
        if (!tracked) return;
        if (failed) this.fail(tracked, 'Some maintenance work failed. Check the server logs or problem files for details.');
        else tracked.job.completed++;
        this.finish(tracked);
    }
    private fail(tracked: Tracked, message: string): void {
        tracked.job.failed++;
        tracked.job.error = message;
    }
    private finish(tracked: Tracked): void {
        if (--tracked.pending !== 0) return;
        tracked.job.state = tracked.job.failed ? 'failed' : 'completed';
        tracked.job.finishedAt = new Date().toISOString();
        let finished = 0;
        this.jobs = this.jobs.filter(({ job }) => job.finishedAt === undefined || ++finished <= 100);
    }
    list(): MaintenanceJob[] { return this.jobs.map(({ job }) => ({ ...job })); }

    /** Stop new scans and wait for every accepted scan to finish discovering jobs. */
    async close(): Promise<void> {
        this.closing = true;
        await Promise.all([...this.discoveries]);
    }
}
