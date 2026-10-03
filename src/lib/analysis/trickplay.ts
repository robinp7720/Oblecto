import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Trickplay } from '../../models/file.js';
import { runBinary } from './process.js';

export type VideoStream = {
    index: number;
    width?: number;
    height?: number;
    sample_aspect_ratio?: string;
    color_transfer?: string;
};

export type TrickplayOptions = {
    ffmpeg: string;
    source: string;
    duration: number;
    video: VideoStream;
    // Directory the sheets end up in; replaced as a whole
    directory: string;
    interval: number;
    width?: number;
    columns?: number;
    rows?: number;
    signal?: AbortSignal;
};

const HDR_TRANSFERS = ['smpte2084', 'arib-std-b67'];
// The same tone mapping playback uses, so HDR thumbnails are not washed out
const TONE_MAP = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2);

/** Thumbnail height for a width, from the video's display aspect ratio. */
export function thumbnailHeight(video: VideoStream, width: number): number {
    const [num, den] = (video.sample_aspect_ratio ?? '1:1').split(':').map(Number);
    const sar = num > 0 && den > 0 ? num / den : 1;
    const displayWidth = (video.width ?? 16) * sar;

    return even(width * (video.height ?? 9) / displayWidth);
}

/**
 * Seek thumbnails, one every `interval` seconds, packed into JPEG sheets named 0.jpg, 1.jpg, ...
 * Only keyframes are decoded, which is many times faster than decoding every frame; a thumbnail
 * shows the keyframe at or before its time.
 */
export async function generateTrickplay(options: TrickplayOptions): Promise<Trickplay> {
    const { ffmpeg, source, duration, video, directory, interval, signal } = options;
    const width = options.width ?? 320;
    const columns = options.columns ?? 10;
    const rows = options.rows ?? 10;
    const height = thumbnailHeight(video, width);
    const count = Math.max(1, Math.ceil(duration / interval));
    const staging = `${directory}.partial-${process.pid}`;
    const filters = (toneMap: boolean): string => [
        ...(toneMap ? [TONE_MAP] : []),
        `fps=1/${interval}:start_time=0`,
        // Sparse keyframes may end well before the movie does. Keep showing the last
        // available keyframe rather than advertising empty tiles near the end.
        `tpad=stop_mode=clone:stop=${count}`,
        `trim=end_frame=${count}`,
        `scale=${width}:${height}`,
        `tile=${columns}x${rows}`
    ].join(',');
    const run = (toneMap: boolean): Promise<Buffer> => runBinary(ffmpeg, [
        '-v', 'error', '-nostdin', '-y', '-threads', '2',
        '-skip_frame', 'nokey', '-i', source,
        '-map', `0:${video.index}`, '-an', '-sn', '-dn',
        '-vf', filters(toneMap), '-fps_mode', 'passthrough',
        '-q:v', '5', '-f', 'image2', '-start_number', '0',
        path.join(staging, '%d.jpg')
    ], signal, 60 * 60 * 1000);

    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });

    try {
        const hdr = HDR_TRANSFERS.includes(video.color_transfer ?? '');

        try {
            await run(hdr);
        } catch (error) {
            // An FFmpeg without zscale cannot tone map; plain thumbnails beat none
            if (!hdr || signal?.aborted) throw error;
            await run(false);
        }

        const names = (await fs.readdir(staging)).filter(name => /^\d+\.jpg$/.test(name));

        if (!names.length) throw new Error('No thumbnails were produced');

        const sizes = await Promise.all(names.map(async name => (await fs.stat(path.join(staging, name))).size));
        const perSheet = columns * rows;

        await fs.rm(directory, { recursive: true, force: true });
        await fs.rename(staging, directory);

        return {
            width,
            height,
            tileWidth: columns,
            tileHeight: rows,
            interval,
            count,
            sheets: names.length,
            bandwidth: Math.ceil(Math.max(...sizes) * 8 / (perSheet * interval))
        };
    } finally {
        await fs.rm(staging, { recursive: true, force: true });
    }
}
