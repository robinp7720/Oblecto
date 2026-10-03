import type { Segment, SegmentType } from '../../models/file.js';

export const SEGMENT_TYPES: SegmentType[] = ['intro', 'credits', 'recap', 'preview'];

/**
 * Segments set by hand, checked and sorted, or the reason they cannot be stored.
 * @param input - Request body's `segments`
 * @param duration - Length of the file in seconds, when known
 */
export function validateSegments(input: unknown, duration?: number | null): { segments: Segment[] } | { error: string } {
    if (!Array.isArray(input)) return { error: 'segments must be a list.' };
    if (input.length > 32) return { error: 'A file can have at most 32 segments.' };

    const limit = Number.isFinite(duration) && (duration as number) > 0 ? duration as number : Infinity;
    const segments: Segment[] = [];

    for (const [index, entry] of input.entries()) {
        const { type, start, end } = (entry ?? {}) as Record<string, unknown>;

        if (!SEGMENT_TYPES.includes(type as SegmentType)) return { error: `segments[${index}].type must be one of ${SEGMENT_TYPES.join(', ')}.` };
        if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= limit || end <= start || end > limit + 1) {
            return { error: `segments[${index}] needs a start and end in seconds, with the start before the end and both inside the file.` };
        }

        segments.push({
            type: type as SegmentType,
            start,
            end: Math.min(end, limit),
            source: 'manual'
        });
    }

    return { segments: segments.sort((a, b) => a.start - b.start) };
}
