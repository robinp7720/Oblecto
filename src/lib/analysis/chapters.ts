import type { Chapter, Segment, SegmentType } from '../../models/file.js';

type RawChapter = {
    start_time?: unknown;
    end_time?: unknown;
    tags?: { title?: unknown };
    'TAG:title'?: unknown;
};

const seconds = (value: unknown): number => (value === null || value === undefined || value === '' ? NaN : Number(value));

/**
 * Chapters from ffprobe's `-show_chapters` output, in order. Chapters without a usable start and end
 * are dropped, and none runs past the end of the file.
 * @param raw - ffprobe's chapters (JSON output, or fluent-ffmpeg's with `TAG:title` keys)
 * @param duration - Length of the file in seconds, when known
 */
export function parseChapters(raw: unknown, duration?: number | null): Chapter[] {
    if (!Array.isArray(raw)) return [];

    const limit = Number.isFinite(duration) && (duration as number) > 0 ? duration as number : Infinity;
    const chapters: Chapter[] = [];

    for (const entry of raw as RawChapter[]) {
        if (!entry || typeof entry !== 'object') continue;

        const start = Math.max(0, seconds(entry.start_time));
        const end = Math.min(limit, seconds(entry.end_time));
        const title = entry.tags?.title ?? entry['TAG:title'];

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

        chapters.push({
            start,
            end,
            title: typeof title === 'string' && title.trim() && title.trim() !== 'N/A' ? title.trim().slice(0, 200) : null
        });
    }

    return chapters.sort((a, b) => a.start - b.start);
}

// Whole chapter titles, so "Introduction" (often the programme itself) or "Credits Scene" do not count.
const TITLES: [SegmentType, RegExp][] = [
    ['intro', /^(intro|opening|opening (credits|titles|theme|song|sequence)|op\s*\d*|title sequence|main titles?|theme song)$/i],
    ['credits', /^(credits|outro|end(ing)?|end(ing)? (credits|titles|theme|song)|closing( credits| titles)?|ed\s*\d*)$/i],
    ['recap', /^(recap|previously|previously on\b.*)$/i],
    ['preview', /^(preview|next episode( preview)?|next time\b.*|next on\b.*)$/i]
];

/** The kind of segment a chapter title names, if any. */
export function segmentTypeForTitle(title: string | null): SegmentType | null {
    if (!title) return null;

    const normalised = title.trim().replace(/[\s_.:-]+/g, ' ').trim();

    return TITLES.find(([, pattern]) => pattern.test(normalised))?.[0] ?? null;
}

/**
 * Segments named by chapter titles. Neighbouring chapters of the same kind become one segment.
 * @param chapters - The file's chapters, in order
 */
export function segmentsFromChapters(chapters: Chapter[]): Segment[] {
    const segments: Segment[] = [];

    for (const chapter of chapters) {
        const type = segmentTypeForTitle(chapter.title);

        if (!type) continue;

        const previous = segments.at(-1);

        if (previous?.type === type && chapter.start - previous.end < 1) previous.end = chapter.end;
        else {
            segments.push({
                type,
                start: chapter.start,
                end: chapter.end,
                source: 'chapters'
            });
        }
    }

    return segments.filter(segment => segment.end - segment.start >= 1);
}
