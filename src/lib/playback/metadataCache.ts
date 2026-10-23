import { PlaybackError } from './types.js';

/** Await shared work without letting one viewer cancel work another viewer still needs. */
export function waitFor<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = (): void => { reject(new PlaybackError('CANCELLED', 'Playback work cancelled', 499)); };
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
        void work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
}

/** File-version keys provide freshness; failed loads are retried and recent loads are bounded. */
export class MetadataCache<T> {
    private entries = new Map<string, Promise<T>>();

    constructor(private readonly limit = 128) {}

    get(key: string, load: () => Promise<T>): Promise<T> {
        let value = this.entries.get(key);
        this.entries.delete(key);
        if (!value) {
            value = Promise.resolve().then(load);
            const pending = value;
            void value.catch(() => {
                if (this.entries.get(key) === pending) this.entries.delete(key);
            });
        }
        this.entries.set(key, value);
        while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
        return value;
    }
}
