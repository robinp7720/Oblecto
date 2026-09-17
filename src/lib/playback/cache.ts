import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { PlaybackError } from './types.js';

type Entry = { path: string; size: number; readers: number; used: number };
export class SegmentCache {
    private entries = new Map<string, Entry>();
    private pending = new Map<string, Promise<Entry>>();
    private reservations = new Map<string, number>();
    readonly root: Promise<string>;
    bytes = 0;
    constructor(
        readonly limit = 10 * 1024 ** 3,
        directory = path.join(os.tmpdir(), 'oblecto-playback')
    ) {
        this.root = this.initialize(directory);
    }
    private async initialize(directory: string): Promise<string> {
        await fs.mkdir(directory, { recursive: true });
        for (const name of await fs.readdir(directory)) {
            if (!/^run-[a-zA-Z0-9]+$/.test(name)) continue;
            const root = path.join(directory, name);
            try {
                const pid = Number(
                    await fs.readFile(path.join(root, 'owner'), 'utf8')
                );
                if (!Number.isSafeInteger(pid) || pid <= 0) continue;
                try {
                    process.kill(pid, 0);
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ESRCH')
                        await fs.rm(root, { recursive: true, force: true });
                }
            } catch {
                /* A concurrent server may still be initializing its directory. */
            }
        }
        const root = await fs.mkdtemp(path.join(directory, 'run-'));
        await fs.writeFile(path.join(root, 'owner'), String(process.pid));
        return root;
    }
    async acquire(
        key: string,
        generate: (output: string) => Promise<void>
    ): Promise<{ path: string; release: () => void }> {
        this.reservations.set(key, (this.reservations.get(key) ?? 0) + 1);
        try {
            let entry = this.entries.get(key);
            if (!entry) {
                let pending = this.pending.get(key);
                if (!pending) {
                    pending = this.generate(key, generate);
                    this.pending.set(key, pending);
                    void pending
                        .finally(() => this.pending.delete(key))
                        .catch(() => {});
                }
                entry = await pending;
            }
            entry.readers++;
            entry.used = Date.now();
            let released = false;
            return {
                path: entry.path,
                release: () => {
                    if (!released) {
                        entry.readers--;
                        released = true;
                    }
                }
            };
        } finally {
            const remaining = this.reservations.get(key)! - 1;
            if (remaining) this.reservations.set(key, remaining);
            else this.reservations.delete(key);
        }
    }
    private async generate(
        key: string,
        generate: (output: string) => Promise<void>
    ): Promise<Entry> {
        const output = path.join(await this.root, randomUUID());
        try {
            await generate(output);
            const { size } = await fs.stat(output);
            for (const [oldKey, old] of [...this.entries].sort(
                (a, b) => a[1].used - b[1].used
            )) {
                if (this.bytes + size <= this.limit) break;
                if (
                    old.readers ||
                    this.reservations.has(oldKey) ||
                    !this.entries.has(oldKey)
                )
                    continue;
                this.entries.delete(oldKey);
                this.bytes -= old.size;
                await fs.rm(old.path, { force: true });
            }
            if (this.bytes + size > this.limit)
                throw new PlaybackError(
                    'STORAGE_FULL',
                    'Playback cache is full',
                    503
                );
            const fresh = {
                path: output,
                size,
                readers: 0,
                used: Date.now()
            };
            this.entries.set(key, fresh);
            this.bytes += size;
            return fresh;
        } catch (error) {
            await fs.rm(output, { force: true });
            throw error;
        }
    }
    async remove(prefix: string): Promise<void> {
        await Promise.allSettled(
            [...this.pending]
                .filter(([key]) => key.startsWith(prefix))
                .map(([, promise]) => promise)
        );
        for (const [key, entry] of this.entries) {
            if (
                !key.startsWith(prefix) ||
                entry.readers ||
                this.reservations.has(key)
            )
                continue;
            this.entries.delete(key);
            this.bytes -= entry.size;
            await fs.rm(entry.path, { force: true });
        }
    }
    async close(): Promise<void> {
        await Promise.allSettled(this.pending.values());
        await fs.rm(await this.root, { force: true, recursive: true });
    }
}
