import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';

/** Serializes read/modify/write transactions, publishing only persisted values. */
export class ConfigWriter {
    private tail: Promise<void> = Promise.resolve();

    constructor(private path: () => string, private write = atomicWrite) {}

    update<T extends object>(current: T, change: (draft: T) => void): Promise<void> {
        const operation = this.tail.then(async () => {
            const draft = structuredClone(current);
            change(draft);
            await this.write(this.path(), JSON.stringify(draft, null, 4));
            Object.assign(current, draft);
        });
        this.tail = operation.catch(() => {});
        return operation;
    }
}

async function atomicWrite(path: string, contents: string): Promise<void> {
    // Resolve symlinks so saving does not replace a symlink to the configuration.
    const destination = await fs.realpath(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return path;
        throw error;
    });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
        const mode = await fs.stat(destination).then(stat => stat.mode & 0o777).catch(() => 0o600);
        const handle = await fs.open(temporary, 'wx', mode);
        try {
            await handle.writeFile(contents);
            await handle.sync();
        } finally {
            await handle.close();
        }
        await fs.rename(temporary, destination);
    } finally {
        await fs.unlink(temporary).catch(() => {});
    }
}
