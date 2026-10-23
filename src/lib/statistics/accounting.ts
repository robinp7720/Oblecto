export type Range = [number, number];
export type Method = 'direct' | 'remux' | 'transcode' | 'unknown';
export interface StatisticsReport {
    position: number;
    failed?: boolean;
    paused?: boolean;
    buffering?: boolean;
    sequence?: number;
    activeSeconds?: number;
    playedRanges?: Range[];
    playbackRate?: number;
    revision?: number;
    firstPlaybackMs?: number;
}
export interface Checkpoint {
    position: number;
    at: number;
    paused: boolean;
    buffering: boolean;
    sequence: number;
    activeSeconds: number;
    ranges: Range[];
    revision: number;
    method: Method;
}
export const initialCheckpoint = (at: number, position = 0): Checkpoint => ({
    position,
    at,
    paused: true,
    buffering: false,
    sequence: -1,
    activeSeconds: 0,
    ranges: [],
    revision: 1,
    method: 'unknown'
});
export function mergeRanges(ranges: Range[]): Range[] {
    const merged: Range[] = [];
    for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
        const last = merged.at(-1);
        if (last && start <= last[1] + 0.01) last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
    }
    return merged;
}
export const coverage = (ranges: Range[]): number => ranges.reduce((sum, [a, b]) => sum + b - a, 0);

/** Returns null for malformed or stale telemetry; progress saving remains independent. */
export function account(previous: Checkpoint, report: StatisticsReport, now: number, duration: number): {
    checkpoint: Checkpoint; seconds: number; quality: 'reported' | 'estimated'; completed: boolean;
} | null {
    if (!Number.isFinite(report.position) || report.position < 0 || (duration > 0 && report.position > duration + 1)) return null;
    if (report.sequence !== undefined && (!Number.isSafeInteger(report.sequence) || report.sequence < 0 || report.sequence <= previous.sequence)) return null;
    if (report.revision !== undefined && report.revision < previous.revision) return null;
    const elapsed = Math.max(0, (now - previous.at) / 1000);
    const native = report.activeSeconds !== undefined && report.playedRanges !== undefined && report.sequence !== undefined;
    let seconds = 0;
    let ranges = previous.ranges.map(([a, b]): Range => [a, b]);
    if (native) {
        if (!Number.isFinite(report.activeSeconds) || report.activeSeconds! < previous.activeSeconds ||
            !Array.isArray(report.playedRanges) || report.playedRanges.length > 1024) return null;
        for (const range of report.playedRanges) {
            if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] < 0 || range[1] < range[0] ||
                (duration > 0 && range[1] > duration + 1)) return null;
        }
        const delta = report.activeSeconds! - previous.activeSeconds;
        // A clock gap is not evidence of continued playback. Establish a new baseline instead.
        if (elapsed <= 60) {
            seconds = Math.min(delta, elapsed);
            const candidate = mergeRanges([...ranges, ...report.playedRanges]);
            // Browsers support fast playback, but a jump across a title is not coverage.
            if (duration > 0 && seconds > 0 && coverage(candidate) - coverage(ranges) <= seconds * 16 + 1) ranges = candidate;
        }
    } else {
        const delta = report.position - previous.position;
        const rate = report.playbackRate ?? 1;
        if (!Number.isFinite(rate) || rate <= 0 || rate > 16) return null;
        if (elapsed <= 60 && !previous.paused && !previous.buffering &&
            (report.revision ?? previous.revision) === previous.revision && delta > 0 && delta <= elapsed * rate + 1) {
            seconds = Math.min(elapsed, delta / rate);
            if (duration > 0) ranges = mergeRanges([...ranges, [previous.position, Math.min(duration, report.position)]]);
        }
    }
    return {
        checkpoint: {
            ...previous,
            position: report.position,
            at: now,
            paused: report.paused === true,
            buffering: report.buffering === true,
            sequence: report.sequence ?? previous.sequence,
            activeSeconds: report.activeSeconds ?? previous.activeSeconds,
            revision: report.revision ?? previous.revision,
            ranges
        },
        seconds,
        quality: native ? 'reported' : 'estimated',
        completed: duration > 0 && coverage(ranges) >= duration * 0.9
    };
}

/** Allocate elapsed time across UTC midnight without inventing activity during a gap. */
export function splitDays(from: number, to: number, seconds: number): Array<{ day: string; seconds: number }> {
    if (seconds <= 0 || to <= from) return [];
    const result: Array<{ day: string; seconds: number }> = [];
    for (let at = from; at < to;) {
        const day = new Date(at).toISOString().slice(0, 10);
        const end = Math.min(to, Date.parse(`${day}T00:00:00Z`) + 86400000);
        result.push({ day, seconds: seconds * (end - at) / (to - from) });
        at = end;
    }
    return result;
}
