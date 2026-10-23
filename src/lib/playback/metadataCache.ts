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

/** Identity includes the configured probe executable so tool changes invalidate stored results. */
export function sourceVersion(source: string, stat: { dev: number; ino: number; size: number; mtimeMs: number }, ffprobe: string): string {
    return JSON.stringify([source, stat.dev, stat.ino, stat.size, stat.mtimeMs, ffprobe]);
}

export type PreparedMetadata = {
    version: 1;
    source: string;
    media: import('./types.js').Media;
    keyframes: { videoIndex: number; times: number[] } | null;
};

export function preparedMetadata(value: PreparedMetadata | null | undefined, source: string): PreparedMetadata | null {
    if (value?.version !== 1 || value.source !== source || !value.media || typeof value.media.path !== 'string' || typeof value.media.container !== 'string' ||
        !Number.isFinite(value.media.size) || value.media.size < 0 || !Array.isArray(value.media.streams) ||
        !Number.isFinite(value.media.duration) || value.media.duration <= 0 || value.media.duration > 7 * 86400 ||
        !value.media.streams.every(track => track && typeof track === 'object' && Number.isSafeInteger(track.index) && typeof track.codec_type === 'string')) return null;
    try {
        const identity = JSON.parse(source) as unknown;
        if (!Array.isArray(identity) || identity[0] !== value.media.path || identity[3] !== value.media.size) return null;
    } catch { return null; }
    if (value.keyframes && (!Number.isSafeInteger(value.keyframes.videoIndex) ||
        !value.media.streams.some(track => track.index === value.keyframes!.videoIndex && track.codec_type === 'video') || !Array.isArray(value.keyframes.times) || !value.keyframes.times.length ||
        value.keyframes.times[0] > 0.05 || !value.keyframes.times.every((time, i, times) =>
            Number.isFinite(time) && time >= 0 && time < value.media.duration && (i === 0 || time > times[i - 1])))) return null;
    return value;
}
