import { runBinary } from './process.js';

/** Seconds of audio per chromaprint point (11025 Hz audio, 4096-sample frames overlapping by two thirds). */
export const POINT_SECONDS = 0.1238;

// Points whose 32 bits differ in more than this many places are different audio.
const MAX_BIT_DIFFERENCE = 6;
// A shared run may have gaps of up to this long where the audio briefly disagrees.
const MAX_GAP_SECONDS = 3.5;
// Ends of a run are trimmed while the average difference over a short window is above this.
const EDGE_WINDOW = 8;
const EDGE_LIMIT = 5;
// A few matching points at either end, cut off from the rest by a pause, are a coincidence.
const ISLAND_GAP_SECONDS = 1;
const ISLAND_SECONDS = 2;

export type SharedRange = {
    // Seconds into each fingerprint
    aStart: number;
    aEnd: number;
    bStart: number;
    bEnd: number;
};

const popcount = (value: number): number => {
    let x = value - ((value >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);

    return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

/**
 * Raw chromaprint fingerprint of part of a file's audio.
 * @param ffmpeg - FFmpeg executable
 * @param path - Media file
 * @param start - Seconds into the file
 * @param length - Seconds of audio
 * @param signal - Cancels the work
 */
export async function fingerprint(ffmpeg: string, path: string, start: number, length: number, signal?: AbortSignal): Promise<Uint32Array> {
    const output = await runBinary(ffmpeg, [
        '-v', 'error', '-nostdin',
        '-ss', start.toFixed(3), '-t', length.toFixed(3),
        '-i', path,
        '-vn', '-sn', '-dn', '-ac', '1',
        '-f', 'chromaprint', '-fp_format', 'raw', '-'
    ], signal, 5 * 60 * 1000);
    const points = new Uint32Array(Math.floor(output.length / 4));

    for (let i = 0; i < points.length; i++) points[i] = output.readUInt32LE(i * 4);

    return points;
}

/**
 * The longest stretch of audio two fingerprints share, at least `minSeconds` long.
 * Candidate alignments come from points that match exactly; each is then scanned for runs of
 * nearly matching points, and the best run's ends are trimmed to where the match is solid.
 * @param a - First fingerprint
 * @param b - Second fingerprint
 * @param minSeconds - Shortest run worth reporting
 */
export function findSharedRange(a: Uint32Array, b: Uint32Array, minSeconds = 15): SharedRange | null {
    const minPoints = Math.ceil(minSeconds / POINT_SECONDS);
    const maxGap = Math.round(MAX_GAP_SECONDS / POINT_SECONDS);

    if (a.length < minPoints || b.length < minPoints) return null;

    const positions = new Map<number, number[]>();

    b.forEach((value, j) => {
        const list = positions.get(value);

        if (list) list.push(j);
        else positions.set(value, [j]);
    });

    const votes = new Map<number, number>();

    a.forEach((value, i) => {
        const list = positions.get(value);

        // A value repeated all over b (silence, a held tone) says nothing about alignment
        if (!list || list.length > 8) return;
        for (const j of list) votes.set(j - i, (votes.get(j - i) ?? 0) + 1);
    });

    const shifts = [...votes].filter(([, count]) => count >= 2).sort((x, y) => y[1] - x[1]).slice(0, 16).map(([shift]) => shift);
    let best: { start: number; end: number; shift: number } | null = null;

    for (const shift of shifts) {
        let runStart = -1;
        let last = -1;

        for (let i = Math.max(0, -shift); i < a.length && i + shift < b.length; i++) {
            if (popcount(a[i] ^ b[i + shift]) > MAX_BIT_DIFFERENCE) continue;
            if (runStart < 0 || i - last > maxGap) runStart = i;
            last = i;
            if (last - runStart + 1 >= minPoints && (!best || last - runStart > best.end - best.start)) {
                best = {
                    start: runStart,
                    end: last,
                    shift
                };
            }
        }
    }

    if (!best) return null;

    const { shift } = best;
    const matches = (i: number): boolean => popcount(a[i] ^ b[i + shift]) <= MAX_BIT_DIFFERENCE;
    const islandGap = Math.round(ISLAND_GAP_SECONDS / POINT_SECONDS);
    const island = Math.round(ISLAND_SECONDS / POINT_SECONDS);
    // The first matching point after a pause of at least islandGap points, searching from `from` in `step` direction
    const acrossPause = (from: number, limit: number, step: 1 | -1): number | null => {
        let quiet = 0;

        for (let i = from; step > 0 ? i <= limit : i >= limit; i += step) {
            if (!matches(i)) quiet++;
            else if (quiet >= islandGap) return i;
            else quiet = 0;
        }

        return null;
    };

    for (let next = acrossPause(best.start, best.end, 1); next !== null && next - best.start < island + islandGap; next = acrossPause(best.start, best.end, 1)) best.start = next;
    for (let next = acrossPause(best.end, best.start, -1); next !== null && best.end - next < island + islandGap; next = acrossPause(best.end, best.start, -1)) best.end = next;

    const mean = (from: number): number => {
        let total = 0;

        for (let k = from; k < from + EDGE_WINDOW; k++) total += popcount(a[k] ^ b[k + shift]);

        return total / EDGE_WINDOW;
    };
    let { start, end } = best;

    while (end - start + 1 > EDGE_WINDOW && (!matches(end) || mean(end - EDGE_WINDOW + 1) > EDGE_LIMIT)) end--;
    while (end - start + 1 > EDGE_WINDOW && (!matches(start) || mean(start) > EDGE_LIMIT)) start++;

    if (end - start + 1 < minPoints) return null;

    // Silence and steady tones fingerprint as a few repeated values, and match anything like them
    if (new Set(a.subarray(start, end + 1)).size < (end - start + 1) / 2) return null;

    return {
        aStart: start * POINT_SECONDS,
        aEnd: (end + 1) * POINT_SECONDS,
        bStart: (start + shift) * POINT_SECONDS,
        bEnd: (end + 1 + shift) * POINT_SECONDS
    };
}

export type EpisodePrint = {
    id: number;
    duration: number;
    intro: { offset: number; points: Uint32Array } | null;
    credits: { offset: number; points: Uint32Array } | null;
};

export type SharedSegments = { intro?: [number, number]; credits?: [number, number] };

// An intro shorter than this is a logo; longer is more likely a shared scene than a title sequence.
const INTRO_SECONDS: [number, number] = [15, 180];
const CREDITS_MIN_SECONDS = 15;
// How many episodes either side each episode is compared with
const NEIGHBOURS = 2;

/**
 * Intros and credits episodes of one season have in common, by comparing each episode's opening
 * and closing audio with its neighbours'. Each episode keeps the longest match it takes part in.
 * @param episodes - The season's episodes in airing order
 * @param only - Ids of the episodes to report; their neighbours are only compared with
 */
export function detectSharedSegments(episodes: EpisodePrint[], only?: Set<number>): Map<number, SharedSegments> {
    const found = new Map<number, SharedSegments>();
    const keep = (id: number, kind: keyof SharedSegments, range: [number, number]): void => {
        if (only && !only.has(id)) return;

        const entry = found.get(id) ?? {};
        const current = entry[kind];

        if (!current || range[1] - range[0] > current[1] - current[0]) entry[kind] = range;
        found.set(id, entry);
    };

    for (let i = 0; i < episodes.length; i++) {
        for (let j = i + 1; j <= i + NEIGHBOURS && j < episodes.length; j++) {
            const a = episodes[i];
            const b = episodes[j];

            if (only && !only.has(a.id) && !only.has(b.id)) continue;

            if (a.intro && b.intro) {
                const shared = findSharedRange(a.intro.points, b.intro.points, INTRO_SECONDS[0]);

                if (shared && shared.aEnd - shared.aStart <= INTRO_SECONDS[1]) {
                    keep(a.id, 'intro', introRange(a.intro.offset + shared.aStart, a.intro.offset + shared.aEnd));
                    keep(b.id, 'intro', introRange(b.intro.offset + shared.bStart, b.intro.offset + shared.bEnd));
                }
            }

            if (a.credits && b.credits) {
                const shared = findSharedRange(a.credits.points, b.credits.points, CREDITS_MIN_SECONDS);

                if (shared) {
                    keep(a.id, 'credits', creditsRange(a.credits.offset + shared.aStart, a.credits.offset + shared.aEnd, a.duration));
                    keep(b.id, 'credits', creditsRange(b.credits.offset + shared.bStart, b.credits.offset + shared.bEnd, b.duration));
                }
            }
        }
    }

    return found;
}

// An intro found to start within the first second starts at the beginning.
const introRange = (start: number, end: number): [number, number] => [start < 1 ? 0 : start, end];

// Credits that run to within a few seconds of the end run to the end.
const creditsRange = (start: number, end: number, duration: number): [number, number] => [start, duration - end < 4 ? duration : end];

/**
 * Where to fingerprint a file: the opening quarter (at most ten minutes) for the intro, and the
 * closing quarter (at most seven minutes) for the credits.
 * @param duration - Length of the file in seconds
 */
export function fingerprintRegions(duration: number): { intro: [number, number]; credits: [number, number] } {
    const intro = Math.min(duration * 0.25, 600);
    const credits = Math.min(duration * 0.25, 420);

    return { intro: [0, intro], credits: [duration - credits, credits] };
}
