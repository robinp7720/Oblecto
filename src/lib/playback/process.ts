import { spawn } from 'node:child_process';
import { PlaybackError } from './types.js';

/** Supervised child process. No shell; completion means the child has actually exited. */
export function run(
    binary: string,
    args: string[],
    signal?: AbortSignal,
    timeoutMs = 60000,
    maxOutput = 16 * 1024 * 1024
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted)
            return reject(
                new PlaybackError('CANCELLED', 'Playback work cancelled', 499)
            );
        const child = spawn(binary, args, {stdio: ['ignore', 'pipe', 'pipe']});
        let output = '';
        let stderr = '';
        let failure: Error | undefined;
        let killTimer: NodeJS.Timeout | undefined;
        const terminate = () => {
            child.kill('SIGTERM');
            killTimer ??= setTimeout(() => child.kill('SIGKILL'), 1500);
        };
        const abort = () => {
            failure = new PlaybackError(
                'CANCELLED',
                'Playback work cancelled',
                499
            );
            terminate();
        };
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => {
            failure = new PlaybackError(
                'ENCODING_TIMEOUT',
                'Media preparation timed out',
                504
            );
            terminate();
        }, timeoutMs);
        child.stdout.on('data', (data: Buffer) => {
            output += data.toString();
            if (output.length > maxOutput) {
                failure = new PlaybackError(
                    'UNSUPPORTED_MEDIA',
                    'Media metadata exceeds supported limits',
                    422
                );
                terminate();
            }
        });
        child.stderr.on('data', (data: Buffer) => {
            stderr = (stderr + data.toString()).slice(-16384);
        });
        child.on('error', () => {
            failure = new PlaybackError(
                'ENCODER_UNAVAILABLE',
                'Configured media executable is unavailable',
                503
            );
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (killTimer) clearTimeout(killTimer);
            signal?.removeEventListener('abort', abort);
            if (failure) reject(failure);
            else if (code !== 0)
                reject(
                    new PlaybackError(
                        /No space left/.test(stderr)
                            ? 'STORAGE_FULL'
                            : 'ENCODING_FAILED',
                        /No space left/.test(stderr)
                            ? 'Playback storage is full'
                            : 'Media preparation failed',
                        503
                    )
                );
            else resolve(output);
        });
    });
}

type Job = {
    owner: string;
    task: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
    signal: AbortSignal;
    abort: () => void;
};
export class Scheduler {
    active = 0;
    private jobs: Job[] = [];
    private lastOwner = '';
    private running = new Set<Promise<unknown>>();
    constructor(
        readonly concurrency = 2,
        readonly maxQueue = 64
    ) {}
    get queued(): number {
        return this.jobs.length;
    }
    submit<T>(
        owner: string,
        signal: AbortSignal,
        task: () => Promise<T>
    ): Promise<T> {
        if (signal.aborted)
            return Promise.reject(
                new PlaybackError('CANCELLED', 'Playback work cancelled', 499)
            );
        if (this.jobs.length >= this.maxQueue)
            return Promise.reject(
                new PlaybackError(
                    'SERVER_CAPACITY',
                    'Playback server is busy; retry shortly',
                    503
                )
            );
        return new Promise<T>((resolve, reject) => {
            const job: Job = {
                owner,
                signal,
                task,
                resolve: resolve as (v: unknown) => void,
                reject,
                abort: () => {}
            };
            job.abort = () => {
                const index = this.jobs.indexOf(job);
                if (index >= 0) {
                    this.jobs.splice(index, 1);
                    reject(
                        new PlaybackError(
                            'CANCELLED',
                            'Playback work cancelled',
                            499
                        )
                    );
                }
            };
            signal.addEventListener('abort', job.abort, { once: true });
            this.jobs.push(job);
            this.drain();
        });
    }
    private drain(): void {
        while (this.active < this.concurrency && this.jobs.length) {
            const index = this.jobs.findIndex(
                (j) => j.owner !== this.lastOwner
            );
            const job = this.jobs.splice(Math.max(index, 0), 1)[0];
            job.signal.removeEventListener('abort', job.abort);
            this.lastOwner = job.owner;
            this.active++;
            const promise = job
                .task()
                .then(job.resolve, job.reject)
                .finally(() => {
                    this.active--;
                    this.running.delete(promise);
                    this.drain();
                });
            this.running.add(promise);
        }
    }
    async settled(): Promise<void> {
        await Promise.allSettled([...this.running]);
    }
}
