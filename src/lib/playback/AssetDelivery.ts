import { promises as fs } from 'node:fs';
import mime from 'mime-types';
import type { Request, Response } from 'express';
import type { File } from '../../models/file.js';
import type { PlaybackSession } from './PlaybackService.js';
import type { SegmentCache } from './cache.js';
import type { SegmentWindows } from './windows.js';
import type { SegmentEncoder } from './SegmentEncoder.js';
import { run, type Scheduler } from './process.js';
import { PlaybackError } from './types.js';
import { renditionBandwidth, renditionCodecs, trackOperations } from './planner.js';
import { sendFile } from './http.js';

export interface DeliveryDependencies {
    cache: SegmentCache;
    scheduler: Scheduler;
    windows: SegmentWindows;
    encoder: Pick<SegmentEncoder, 'segment'>;
    ffmpeg(): string;
    encoderMode(): 'segment' | 'window' | undefined;
    trickplaySheet(file: File, index: number): string | null | undefined;
}

/** Asset formatting and delivery. The service validates revisions and tracks active requests. */
export class AssetDelivery {
    constructor(private readonly dependencies: DeliveryDependencies) {}
    private get ffmpeg(): string { return this.dependencies.ffmpeg(); }
    async serveTrickplay(
        s: PlaybackSession,
        index: number,
        req: Request,
        res: Response
    ): Promise<void> {
        const sheet = s.remote ? null : this.dependencies.trickplaySheet(s.file, index);
        if (!sheet)
            throw new PlaybackError('MEDIA_NOT_FOUND', 'No such thumbnail sheet', 404);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('Referrer-Policy', 'no-referrer');
        await sendFile(req, res, sheet, 'image/jpeg', s.signal.signal);
    }
    async serve(
        s: PlaybackSession,
        asset: string,
        req: Request,
        res: Response
    ): Promise<void> {
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        const firstByte = (): void => {
            if (s.timings.firstMediaMs !== null || req.method !== 'GET') return;
            s.startupMs = s.timings.firstMediaMs = Math.round(performance.now() - s.startedMonotonic);
        };
        if (s.remote) {
            await s.remote.client.serve(s.remote.id, asset, req, res, asset === 'original' || /^[a-z0-9]+-\d+\.ts$/.test(asset) ? firstByte : undefined);
            return;
        }
        const plan = s.plan;
        const link = (name: string) => `${name}?token=${s.token}`;
        if (asset === 'original') {
            if (plan.method !== 'direct')
                throw new PlaybackError(
                    'INVALID_SELECTION',
                    'Original playback was not negotiated'
                );
            await sendFile(
                req,
                res,
                s.media.path,
                mime.lookup(s.media.path) || 'application/octet-stream',
                s.signal.signal,
                firstByte
            );
            return;
        }
        if (s.options.forceDirect === true)
            throw new PlaybackError(
                'MEDIA_NOT_FOUND',
                'Playback asset does not exist',
                404
            );
        if (asset === 'master.m3u8') {
            const tracks =
                plan.subtitle && !plan.burnSubtitles
                    ? [`#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Subtitles",DEFAULT=YES,AUTOSELECT=YES,URI="${link('subtitles.m3u8')}"`]
                    : [];
            const variants = plan.renditions.flatMap((r) => [
                `#EXT-X-STREAM-INF:BANDWIDTH=${renditionBandwidth(plan, r.bitrate).peak},AVERAGE-BANDWIDTH=${renditionBandwidth(plan, r.bitrate).average},CODECS="${renditionCodecs(plan)}"${plan.video && r.height ? `,RESOLUTION=${Math.floor(((plan.video.width ?? 640) * r.height) / (plan.video.height ?? 360) / 2) * 2}x${r.height}` : ''}${tracks.length ? ',SUBTITLES="subs"' : ''}`,
                link(`${r.id}.m3u8`)
            ]);
            res.type('application/vnd.apple.mpegurl').send(
                [
                    '#EXTM3U',
                    '#EXT-X-VERSION:3',
                    ...tracks,
                    ...variants,
                    ''
                ].join('\n')
            );
            return;
        }
        if (
            asset === 'subtitles.m3u8' &&
            plan.subtitle &&
            !plan.burnSubtitles
        ) {
            res.type('application/vnd.apple.mpegurl').send(
                `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${Math.ceil(s.media.duration)}\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:${s.media.duration.toFixed(6)},\n${link('subtitle.vtt')}\n#EXT-X-ENDLIST\n`
            );
            return;
        }
        const variant = /^([a-z0-9]+)\.m3u8$/.exec(asset);
        if (variant && plan.renditions.some((r) => r.id === variant[1])) {
            const durations = plan.boundaries
                .slice(0, -1)
                .map((t, i) => plan.boundaries[i + 1] - t);
            res.type('application/vnd.apple.mpegurl').send(
                [
                    '#EXTM3U',
                    '#EXT-X-VERSION:3',
                    `#EXT-X-TARGETDURATION:${Math.ceil(durations.reduce((max, duration) => Math.max(max, duration), 0))}`,
                    '#EXT-X-MEDIA-SEQUENCE:0',
                    '#EXT-X-PLAYLIST-TYPE:VOD',
                    ...durations.flatMap((d, i) => [
                        `#EXTINF:${d.toFixed(6)},`,
                        link(`${variant[1]}-${i}.ts`)
                    ]),
                    '#EXT-X-ENDLIST',
                    ''
                ].join('\n')
            );
            return;
        }
        if (asset === 'subtitle.vtt' || /^subtitle-\d+\.vtt$/.test(asset)) {
            const subtitle = asset === 'subtitle.vtt' ? plan.subtitle : s.media.streams.find(track => track.codec_type === 'subtitle' && track.index === Number(asset.slice(9, -4)));
            if (!subtitle || !['subrip', 'webvtt', 'mov_text', 'text'].includes(subtitle.codec_name ?? '')) throw new PlaybackError('UNSUPPORTED_MEDIA', 'Subtitle requires video rendering', 422);
            const lease = await this.dependencies.cache.acquire(
                `${s.sessionId}/${s.revision}/vtt/${subtitle.index}`,
                (file) =>
                    this.dependencies.scheduler.submit(
                        s.sessionId,
                        s.signal.signal,
                        async () => {
                            await run(
                                this.ffmpeg,
                                [
                                    '-v',
                                    'error',
                                    '-y',
                                    '-i',
                                    s.media.path,
                                    '-map',
                                    `0:${subtitle.index}`,
                                    '-f',
                                    'webvtt',
                                    file
                                ],
                                s.signal.signal
                            );
                            if ((await fs.stat(file)).size > 16 * 1024 ** 2)
                                throw new PlaybackError(
                                    'UNSUPPORTED_MEDIA',
                                    'Subtitle track exceeds supported size',
                                    422
                                );
                            const contents = await fs.readFile(file, 'utf8');
                            await fs.writeFile(
                                file,
                                contents.replace(
                                    'WEBVTT',
                                    'WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0'
                                )
                            );
                        }
                    )
            );
            try {
                await sendFile(
                    req,
                    res,
                    lease.path,
                    'text/vtt',
                    s.signal.signal
                );
            } finally {
                lease.release();
            }
            return;
        }
        const segment = /^([a-z0-9]+)-(\d+)\.ts$/.exec(asset);
        if (
            !segment ||
            !plan.renditions.some((r) => r.id === segment[1]) ||
            Number(segment[2]) >= plan.boundaries.length - 1
        )
            throw new PlaybackError(
                'MEDIA_NOT_FOUND',
                'Playback asset does not exist',
                404
            );
        const index = Number(segment[2]);
        const revision = s.revision;
        this.dependencies.scheduler.promote(s.sessionId, `${s.sessionId}/${revision}/${segment[1]}/${index}`);
        const track = (operation: Promise<void>) => {
            s.operations.add(operation);
            void operation.finally(() => s.operations.delete(operation)).catch(() => {});
        };
        const acquire = (n: number, priority = 0) => {
            const scope = `${s.sessionId}/${revision}/${segment[1]}`;
            const queuedAt = performance.now();
            const encode = (directory: string, first: number, end: number, signal: AbortSignal) =>
                this.dependencies.scheduler.submit(s.sessionId, signal, () => {
                    s.delivery.queueWaitMs = performance.now() - queuedAt;
                    return this.dependencies.encoder.segment(s, segment[1], first, directory, end, signal, true);
                }, priority);
            if (this.dependencies.encoderMode() === 'window' && trackOperations(s.plan).video === 'encode')
                return this.dependencies.windows.acquire(s.sessionId, scope, n, plan.boundaries.length - 1, s.signal.signal, encode, track);
            return this.dependencies.cache.acquire(`${scope}/${n}`, file =>
                this.dependencies.scheduler.submit(s.sessionId, s.signal.signal, () => {
                    s.delivery.queueWaitMs = performance.now() - queuedAt;
                    return this.dependencies.encoder.segment(s, segment[1], n, file);
                }, priority, `${scope}/${n}`));
        };
        const lease = await acquire(index);
        // Encode ahead during transfer; slow clients no longer serialize these two costs.
        if (this.dependencies.encoderMode() !== 'window' || trackOperations(s.plan).video !== 'encode') {
            for (let ahead = 1; ahead <= 2; ahead++) {
                if (index + ahead >= plan.boundaries.length - 1 || this.dependencies.scheduler.queued > 0 || s.signal.signal.aborted) break;
                track(acquire(index + ahead, 1).then(l => l.release()).catch(() => {}));
            }
        }
        try {
            await sendFile(req, res, lease.path, 'video/mp2t', s.signal.signal, firstByte);
        } finally { lease.release(); }

    }
}
