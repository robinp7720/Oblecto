import { createReadStream, promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { PlaybackError } from './types.js';
export function byteRange(
    value: string | undefined,
    size: number
): { start: number; end: number } | null {
    if (!value) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(value);
    const fail = (): never => {
        throw new PlaybackError(
            'INVALID_RANGE',
            'Requested byte range is not satisfiable',
            416
        );
    };
    if (!match || (!match[1] && !match[2]) || size === 0) return fail();
    let start: number;
    let end: number;
    if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) return fail();
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start >= size ||
            end < start
        )
            return fail();
        end = Math.min(end, size - 1);
    }
    return { start, end };
}
export async function sendFile(
    req: Request,
    res: Response,
    file: string,
    mime: string,
    signal?: AbortSignal
): Promise<void> {
    const { size } = await fs.stat(file).catch(() => {
        throw new PlaybackError('MEDIA_NOT_FOUND', 'Media file is unavailable', 404);
    });
    let range;
    try {
        range =
            req.method === 'HEAD' ? null : byteRange(req.headers.range, size);
    } catch (error) {
        res.setHeader('Content-Range', `bytes */${size}`);
        throw error;
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', range ? range.end - range.start + 1 : size);
    res.status(range ? 206 : 200);
    if (range)
        res.setHeader(
            'Content-Range',
            `bytes ${range.start}-${range.end}/${size}`
        );
    if (req.method === 'HEAD' || size === 0) {
        res.end();
        return;
    }
    const stream = createReadStream(file, range ?? undefined);
    try {
        if (signal) await pipeline(stream, res, { signal });
        else await pipeline(stream, res);
    } catch (error) {
        if (!res.destroyed && !signal?.aborted) throw error;
    }
}
