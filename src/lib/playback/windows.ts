import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { SegmentCache } from './cache.js';
import { PlaybackError } from './types.js';

type Ready = { promise: Promise<string>; resolve: (path: string) => void; reject: (error: unknown) => void };
type Window = { scope: string; start: number; end: number; signal: AbortController; ready: Map<number, Ready>; done: Promise<void> };

/** Bounded sequential producers; the shared cache owns all published files and reader leases. */
export class SegmentWindows {
    private active = new Map<string, Window>();
    constructor(private cache: SegmentCache) {}

    acquire(
        owner: string, scope: string, index: number, count: number, signal: AbortSignal,
        generate: (directory: string, start: number, end: number, signal: AbortSignal) => Promise<void>,
        track: (operation: Promise<void>) => void
    ) {
        return this.cache.acquire(`${scope}/${index}`, async output => {
            let window = this.active.get(owner);
            if (window?.scope !== scope || index < window.start || index >= window.end || !window.ready.has(index) || window.signal.signal.aborted) {
                const previous = window;
                previous?.signal.abort();
                const controller = new AbortController();
                const abort = () => controller.abort();
                signal.addEventListener('abort', abort, { once: true });
                if (signal.aborted) controller.abort();
                const ready = new Map<number, Ready>();
                const end = Math.min(count, index + 6);
                for (let n = index; n < end; n++) {
                    let resolve!: Ready['resolve']; let reject!: Ready['reject'];
                    const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
                    void promise.catch(() => {});
                    ready.set(n, {
                        promise, resolve, reject
                    });
                }
                window = {
                    scope, start: index, end, signal: controller, ready, done: Promise.resolve()
                };
                this.active.set(owner, window);
                const current = window;
                current.done = (async () => {
                    // Await the previous producer so rapid seeks cannot accumulate child processes.
                    let directory: string | undefined;
                    let encoding: Promise<void> | undefined;
                    const prefills: Promise<unknown>[] = [];
                    let failure: unknown = new PlaybackError('ENCODING_FAILED', 'Media segment was not produced', 503);
                    try {
                        await previous?.done.catch(() => {});
                        if (controller.signal.aborted) throw new PlaybackError('CANCELLED', 'Playback work cancelled', 499);
                        directory = await fs.mkdtemp(path.join(await this.cache.root, 'window-'));
                        // Reserve every publication before encoding starts. Concurrent demand shares it.
                        for (const [n, item] of ready) {
                            const prefill = this.cache.acquire(`${scope}/${n}`, async file => {
                                await fs.copyFile(await item.promise, file);
                            }).then(lease => { lease.release(); ready.delete(n); });
                            void prefill.catch(error => { failure = error; controller.abort(); });
                            prefills.push(prefill);
                        }
                        let finished = false;
                        encoding = generate(directory, index, end, controller.signal)
                            .catch(error => { failure = error; })
                            .finally(() => { finished = true; });
                        while (true) {
                            for (const [n, item] of ready) {
                                // FFmpeg's temp_file flag renames only closed, complete segments.
                                const file = path.join(directory, `${n}.ts`);
                                if (await fs.stat(file).then(() => true, () => false)) item.resolve(file);
                            }
                            if (finished) break;
                            await delay(25);
                        }
                        await encoding;
                    } catch (error) { failure = error; controller.abort(); }
                    finally {
                        for (const item of ready.values()) item.reject(failure);
                        await encoding;
                        await Promise.allSettled(prefills);
                        try { if (directory) await fs.rm(directory, { recursive: true, force: true }); }
                        finally {
                            signal.removeEventListener('abort', abort);
                            if (this.active.get(owner) === current) this.active.delete(owner);
                        }
                    }
                })();
                // Lifecycle ownership includes publication, subprocess exit and staging cleanup.
                track(current.done);
            }
            await fs.copyFile(await window.ready.get(index)!.promise, output);
        });
    }
}
