import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import mime from 'mime-types';
import type { Request, Response } from 'express';
import type Oblecto from '../oblecto/index.js';
import type { File } from '../../models/file.js';
import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';
import { PlaybackError, validateOptions } from './types.js';
import type { Media, PlaybackOptions, PlaybackPlan, Track } from './types.js';
import { planPlayback } from './planner.js';
import { run, Scheduler } from './process.js';
import { SegmentCache } from './cache.js';
import { sendFile } from './http.js';
import { saveProgress } from './progress.js';
import logger from '../../submodules/logger/index.js';

export type RemoteSessionData = {
    sessionId: string;
    revision: number;
    media: Media;
    plan: PlaybackPlan;
};
export type RemotePlayback = {
    request(operation: string, payload: unknown): Promise<RemoteSessionData>;
    serve(
        sessionId: string,
        asset: string,
        req: Request,
        res: Response
    ): Promise<void>;
    close(): void;
};
export class PlaybackSession {
    readonly sessionId = randomUUID();
    readonly token = randomBytes(32).toString('hex');
    revision = 1;
    state = 'ready';
    position = 0;
    paused = true;
    updatedAt = Date.now();
    createdAt = Date.now();
    startupMs: number | null = null;
    failure: string | null = null;
    bufferingReports = 0;
    encodingSpeed: number | null = null;
    signal = new AbortController();
    operations = new Set<Promise<unknown>>();
    mutation: Promise<unknown> = Promise.resolve();
    remote?: { client: RemotePlayback; id: string };
    constructor(
        readonly owner: string,
        readonly userId: number | null,
        readonly file: File,
        public options: PlaybackOptions,
        public media: Media,
        public plan: PlaybackPlan
    ) {
        this.position = options.position ?? 0;
    }
    touch(): void {
        this.updatedAt = Date.now();
    }
}
export class PlaybackService {
    readonly sessions = new Map<string, PlaybackSession>();
    readonly scheduler: Scheduler;
    readonly cache: SegmentCache;
    private readonly timer: NodeJS.Timeout;
    private readonly idleMs: number;
    private closing = false;
    private lifetime = new AbortController();
    private pendingPeers = new Set<RemotePlayback>();
    private hardware?: Promise<string | null>;
    private probes = new Map<string, Promise<Media>>();
    private creation = new Set<Promise<PlaybackSession>>();
    remoteFactory?: (host: string) => Promise<RemotePlayback>;
    constructor(readonly oblecto: Oblecto) {
        const config = oblecto.config.streaming;
        for (const [name, value] of Object.entries({
            concurrency: config?.encodingConcurrency ?? 2,
            queue: config?.maxQueue ?? 64,
            cache: config?.cacheBytes ?? 10 * 1024 ** 3,
            idle: config?.idleTimeoutMs ?? 1800000
        })) {
            if (!Number.isSafeInteger(value) || value <= 0)
                throw new PlaybackError(
                    'INVALID_CONFIG',
                    `Invalid playback ${name} limit`,
                    500
                );
        }
        this.scheduler = new Scheduler(
            config?.encodingConcurrency ?? 2,
            config?.maxQueue ?? 64
        );
        this.cache = new SegmentCache(
            config?.cacheBytes ?? 10 * 1024 ** 3,
            config?.cacheDirectory
        );
        this.idleMs = config?.idleTimeoutMs ?? 30 * 60 * 1000;
        this.timer = setInterval(() => {
            for (const s of this.sessions.values())
                if (Date.now() - s.updatedAt > this.idleMs)
                    void this.stop(s).catch(() => {});
        }, 30000);
        this.timer.unref();
    }
    get ffmpeg(): string {
        return this.oblecto.config.ffmpeg.pathFFmpeg || 'ffmpeg';
    }
    get ffprobe(): string {
        return this.oblecto.config.ffmpeg.pathFFprobe || 'ffprobe';
    }
    async probe(file: File): Promise<Media> {
        if (!file.path)
            throw new PlaybackError(
                'UNSUPPORTED_MEDIA',
                'Media file has no source',
                422
            );
        const stat = await fs.stat(file.path).catch(() => {
            throw new PlaybackError(
                'MEDIA_NOT_FOUND',
                'Media file is unavailable',
                404
            );
        });
        const key = `${file.id}:${stat.size}:${stat.mtimeMs}`;
        let probe = this.probes.get(key);
        if (!probe) {
            probe = this.scheduler.submit(
                'probe',
                this.lifetime.signal,
                async () => {
                    const data = JSON.parse(
                        await run(
                            this.ffprobe,
                            [
                                '-v',
                                'error',
                                '-show_streams',
                                '-show_format',
                                '-of',
                                'json',
                                file.path!
                            ],
                            this.lifetime.signal
                        )
                    ) as { format?: { duration?: string }; streams: Track[] };
                    const duration = Number(
                        data.format?.duration ?? file.duration
                    );
                    if (
                        !Number.isFinite(duration) ||
                        duration <= 0 ||
                        duration > 7 * 86400
                    )
                        throw new PlaybackError(
                            'UNSUPPORTED_MEDIA',
                            'A finite media duration is required',
                            422
                        );
                    return {
                        path: file.path!,
                        duration,
                        size: stat.size,
                        container: (
                            file.extension ??
                            file.path!.split('.').at(-1) ??
                            ''
                        ).toLowerCase(),
                        streams: data.streams
                    };
                }
            );
            if (this.probes.size >= 128)
                this.probes.delete(this.probes.keys().next().value!);
            this.probes.set(key, probe);
            void probe.catch(() => this.probes.delete(key));
        }
        return probe;
    }
    async prepare(
        media: Media,
        options: PlaybackOptions,
        signal: AbortSignal
    ): Promise<PlaybackPlan> {
        const plan = planPlayback(
            media,
            options,
            this.oblecto.config.streaming?.defaultTargetLanguageCode
        );
        if (plan.method === 'remux' && plan.video) {
            try {
                const output = await this.scheduler.submit(
                    'keyframes',
                    signal,
                    () =>
                        run(
                            this.ffprobe,
                            [
                                '-v',
                                'error',
                                '-select_streams',
                                String(plan.video!.index),
                                '-skip_frame',
                                'nokey',
                                '-show_frames',
                                '-show_entries',
                                'frame=best_effort_timestamp_time',
                                '-of',
                                'json',
                                media.path
                            ],
                            signal
                        )
                );
                const times: number[] = (
                    JSON.parse(output) as {
                        frames: { best_effort_timestamp_time: string }[];
                    }
                ).frames
                    .map((f: { best_effort_timestamp_time: string }) =>
                        Number(f.best_effort_timestamp_time)
                    )
                    .filter(
                        (t: number) =>
                            Number.isFinite(t) && t >= 0 && t < media.duration
                    );
                if (!times.length || times[0] > 0.05)
                    throw new Error('No usable keyframe timeline');
                plan.boundaries = [0];
                for (const time of times)
                    if (time - plan.boundaries.at(-1)! >= 3.95)
                        plan.boundaries.push(time);
                plan.boundaries.push(media.duration);
            } catch (error) {
                if (signal.aborted) throw error;
                return planPlayback(
                    media,
                    { ...options, quality: 'auto' },
                    this.oblecto.config.streaming?.defaultTargetLanguageCode
                );
            }
        }
        return plan;
    }
    create(
        file: File,
        owner: string,
        userId: number | null,
        options: PlaybackOptions = {}
    ): Promise<PlaybackSession> {
        const promise = this.createSession(
            file,
            owner,
            userId,
            validateOptions(options)
        );
        this.creation.add(promise);
        void promise
            .finally(() => this.creation.delete(promise))
            .catch(() => {});
        return promise;
    }
    private async createSession(
        file: File,
        owner: string,
        userId: number | null,
        options: PlaybackOptions
    ): Promise<PlaybackSession> {
        if (this.closing)
            throw new PlaybackError(
                'SERVER_CAPACITY',
                'Playback server is stopping',
                503
            );
        let session: PlaybackSession;
        if (file.host && file.host !== 'local') {
            if (!this.remoteFactory)
                throw new PlaybackError(
                    'REMOTE_UNAVAILABLE',
                    'Federation playback is unavailable',
                    503
                );
            const client = await this.remoteFactory(file.host);
            if (this.closing) {
                client.close();
                throw new PlaybackError(
                    'CANCELLED',
                    'Playback server is stopping',
                    503
                );
            }
            this.pendingPeers.add(client);
            try {
                const data = await client.request('create', {
                    fileId: file.path,
                    options
                });
                session = new PlaybackSession(
                    owner,
                    userId,
                    file,
                    options,
                    data.media,
                    data.plan
                );
                session.remote = { client, id: data.sessionId };
            } catch (error) {
                client.close();
                throw error;
            } finally {
                this.pendingPeers.delete(client);
            }
        } else {
            const media = await this.probe(file);
            const plan = await this.prepare(
                media,
                options,
                this.lifetime.signal
            );
            session = new PlaybackSession(
                owner,
                userId,
                file,
                options,
                media,
                plan
            );
        }
        if (session.position > session.media.duration)
            session.position = session.media.duration;
        this.sessions.set(session.sessionId, session);
        if (this.closing) {
            await this.stop(session);
            throw new PlaybackError(
                'SERVER_CAPACITY',
                'Playback server is stopping',
                503
            );
        }
        return session;
    }
    get(id: string, owner?: string): PlaybackSession {
        const session = this.sessions.get(id);
        if (
            !session ||
            Date.now() - session.updatedAt > this.idleMs ||
            (owner !== undefined && session.owner !== owner)
        )
            throw new PlaybackError(
                'SESSION_EXPIRED',
                'Playback session is unavailable',
                404
            );
        return session;
    }
    describe(s: PlaybackSession, base = '/playback/media') {
        const url = (asset: string) =>
            `${base}/${s.sessionId}/${s.revision}/${asset}?token=${s.token}`;
        return {
            sessionId: s.sessionId,
            revision: s.revision,
            state: s.state,
            duration: s.media.duration,
            position: s.position,
            paused: s.paused,
            method: s.plan.method,
            reason: s.plan.reason,
            mediaUrl: url(
                s.plan.method === 'direct' ? 'original' : 'master.m3u8'
            ),
            selectedTracks: {
                audioStreamIndex: s.plan.audio?.index ?? null,
                subtitleStreamIndex: s.plan.subtitle?.index ?? null,
                subtitleMode: s.options.subtitleMode ?? 'auto'
            },
            tracks: s.media.streams.filter((t) =>
                ['audio', 'subtitle'].includes(t.codec_type)
            ),
            qualities: s.plan.renditions,
            subtitleUrl:
                s.plan.subtitle && !s.plan.burnSubtitles
                    ? url('subtitle.vtt')
                    : null
        };
    }
    update(
        s: PlaybackSession,
        options: PlaybackOptions,
        revision: number
    ): Promise<void> {
        const operation = s.mutation
            .catch(() => {})
            .then(async () => {
                if (s.signal.signal.aborted || revision !== s.revision)
                    throw new PlaybackError(
                        'STALE_REVISION',
                        'Playback session has changed',
                        409
                    );
                const next = validateOptions({ ...s.options, ...options });
            if (options.subtitleMode !== undefined && options.subtitleStreamIndex === undefined) delete next.subtitleStreamIndex;
                let plan: PlaybackPlan;
                if (s.remote) {
                    const data = await s.remote.client.request('update', {
                        sessionId: s.remote.id,
                        options: next,
                        revision
                    });
                    plan = data.plan;
                } else
                    plan = await this.prepare(s.media, next, s.signal.signal);
                if (s.signal.signal.aborted)
                    throw new PlaybackError(
                        'SESSION_EXPIRED',
                        'Playback session has ended',
                        404
                    );
                const old = `${s.sessionId}/${s.revision}/`;
                s.signal.abort();
                await Promise.allSettled(s.operations);
                s.signal = new AbortController();
                s.revision++;
                s.options = next;
                s.plan = plan;
                s.position = Math.min(
                    next.position ?? s.position,
                    s.media.duration
                );
                s.state = 'ready';
                s.failure = null;
                s.touch();
                await this.cache.remove(old);
            });
        s.mutation = operation;
        return operation;
    }
    report(
        s: PlaybackSession,
        data: {
            revision: number;
            position: number;
            paused?: boolean;
            buffering?: boolean;
        }
    ): Promise<void> {
        const promise = this.saveReport(s, data);
        s.operations.add(promise);
        void promise
            .finally(() => s.operations.delete(promise))
            .catch(() => {});
        return promise;
    }
    private async saveReport(
        s: PlaybackSession,
        data: {
            revision: number;
            position: number;
            paused?: boolean;
            buffering?: boolean;
        }
    ): Promise<void> {
        if (data.revision !== s.revision)
            throw new PlaybackError(
                'STALE_REVISION',
                'Playback session has changed',
                409
            );
        if (
            !Number.isFinite(data.position) ||
            data.position < 0 ||
            data.position > s.media.duration + 1
        )
            throw new PlaybackError(
                'INVALID_SELECTION',
                'Invalid playback position'
            );
        s.position = Math.min(data.position, s.media.duration);
        s.paused = data.paused === true;
        s.touch();
        s.state = s.paused ? 'paused' : 'playing';
        if (data.buffering) s.bufferingReports++;
        if (s.remote)
            await s.remote.client.request('heartbeat', {sessionId: s.remote.id});
        await this.persist(s, data.position, data.revision);
    }
    private async persist(
        s: PlaybackSession,
        position: number,
        revision: number
    ): Promise<void> {
        if (s.userId === null) return;
        const movie = await Movie.findOne({include: [{ association: 'Files', where: { id: s.file.id } }]});
        if (revision !== s.revision) return;
        if (movie)
            return saveProgress(
                s.userId,
                'movie',
                movie.id,
                position,
                s.media.duration
            );
        const episode = await Episode.findOne({include: [{ association: 'Files', where: { id: s.file.id } }]});
        if (episode && revision === s.revision)
            await saveProgress(
                s.userId,
                'episode',
                episode.id,
                position,
                s.media.duration
            );
    }
    async stop(s: PlaybackSession): Promise<void> {
        if (!this.sessions.delete(s.sessionId)) return;
        s.state = 'ended';
        s.signal.abort();
        await Promise.allSettled([s.mutation, ...s.operations]);
        if (s.remote) {
            await s.remote.client
                .request('stop', { sessionId: s.remote.id })
                .catch(() => {});
            s.remote.client.close();
        }
        await this.cache.remove(`${s.sessionId}/`);
    }
    async close(): Promise<void> {
        this.closing = true;
        clearInterval(this.timer);
        this.lifetime.abort();
        for (const peer of this.pendingPeers) peer.close();
        for (const session of this.sessions.values()) session.signal.abort();
        await Promise.allSettled(this.creation);
        await Promise.allSettled(
            [...this.sessions.values()].map((s) => this.stop(s))
        );
        await this.scheduler.settled();
        await this.cache.close();
    }
    diagnostics(owner?: string): Record<string, unknown>[] {
        return [...this.sessions.values()]
            .filter(
                (s) =>
                    owner === undefined ||
                    s.owner === owner ||
                    (owner.startsWith('user:') &&
                        s.userId === Number(owner.slice(5)))
            )
            .map((s) => ({
                sessionId: s.sessionId,
                state: s.state,
                file: { id: s.file.id },
                method: s.plan.method,
                reason: s.plan.reason,
                position: s.position,
                startupMs: s.startupMs,
                bufferingReports: s.bufferingReports,
                encodingSpeed: s.encodingSpeed,
                failure: s.failure,
                queueDepth: this.scheduler.queued,
                activeEncoders: this.scheduler.active,
                cacheBytes: this.cache.bytes,
                output: {
                    format:
                        s.plan.method === 'direct' ? s.media.container : 'hls',
                    videoCodec:
                        s.plan.method === 'transcode'
                            ? 'h264'
                            : s.plan.video?.codec_name,
                    audioCodec:
                        s.plan.method === 'transcode'
                            ? 'aac'
                            : s.plan.audio?.codec_name
                }
            }));
    }
    serve(
        s: PlaybackSession,
        revision: number,
        asset: string,
        req: Request,
        res: Response
    ): Promise<void> {
        if (revision !== s.revision || s.signal.signal.aborted)
            return Promise.reject(
                new PlaybackError(
                    'STALE_REVISION',
                    'Playback output has changed',
                    409
                )
            );
        s.touch();
        const promise = this.serveAsset(s, asset, req, res).catch((error) => {
            if (!s.signal.signal.aborted && !res.destroyed) {
                s.failure =
                    error instanceof PlaybackError
                        ? error.code
                        : 'ENCODING_FAILED';
                logger.warn(`Playback ${s.sessionId}: ${s.failure}`);
            }
            throw error;
        });
        s.operations.add(promise);
        void promise
            .finally(() => s.operations.delete(promise))
            .catch(() => {});
        return promise;
    }
    private async encoder(): Promise<string | null> {
        this.hardware ??= (async () => {
            if (!this.oblecto.config.transcoding?.hardwareAcceleration)
                return null;
            const type = this.oblecto.config.transcoding.hardwareAccelerator;
            const candidate =
                type === 'cuda'
                    ? 'h264_nvenc'
                    : type === 'vaapi'
                      ? 'h264_vaapi'
                      : null;
            if (!candidate) return null;
            const available = await run(this.ffmpeg, [
                '-hide_banner',
                '-encoders'
            ]).catch(() => '');
            return available.includes(candidate) ? candidate : null;
        })();
        return this.hardware;
    }
    private async segment(
        s: PlaybackSession,
        rendition: string,
        index: number,
        output: string
    ): Promise<void> {
        const plan = s.plan;
        const start = plan.boundaries[index];
        const length = plan.boundaries[index + 1] - start;
        const quality = plan.renditions.find((r) => r.id === rendition)!;
        const args = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-nostdin',
            '-y',
            '-ss',
            String(start),
            '-i',
            s.media.path,
            '-t',
            String(length)
        ];
        if (plan.video) args.push('-map', `0:${plan.video.index}`);
        else args.push('-vn');
        if (plan.audio) args.push('-map', `0:${plan.audio.index}`);
        else args.push('-an');
        args.push('-sn');
        const encode = async (hardware: string | null) => {
            const command = [...args];
            if (plan.method === 'remux') command.push('-c', 'copy');
            else {
                if (plan.video) {
                    const filters: string[] = [];
                    if (plan.hdr)
                        filters.push(
                            'zscale=t=linear:npl=100',
                            'format=gbrpf32le',
                            'zscale=p=bt709',
                            'tonemap=tonemap=hable:desat=0',
                            'zscale=t=bt709:m=bt709:r=tv'
                        );
                    if (plan.burnSubtitles && plan.subtitle) {
                        if (
                            ['ass', 'ssa'].includes(
                                plan.subtitle.codec_name ?? ''
                            )
                        ) {
                            // Use a safe generated filename rather than interpolating source paths into filter expressions.
                            const lease = await this.cache.acquire(
                                `${s.sessionId}/${s.revision}/ass`,
                                async (file) => {
                                    await run(
                                        this.ffmpeg,
                                        [
                                            '-v',
                                            'error',
                                            '-y',
                                            '-i',
                                            s.media.path,
                                            '-map',
                                            `0:${plan.subtitle!.index}`,
                                            '-c:s',
                                            'ass',
                                            '-f',
                                            'ass',
                                            file
                                        ],
                                        s.signal.signal
                                    );
                                }
                            );
                            try {
                                filters.push(
                                    `setpts=PTS+${start}/TB`,
                                    `ass=filename='${lease.path}'`,
                                    `setpts=PTS-STARTPTS`
                                );
                                await this.encodeVideo(
                                    s,
                                    command,
                                    filters,
                                    quality,
                                    hardware,
                                    start,
                                    output
                                );
                            } finally {
                                lease.release();
                            }
                            return;
                        }
                        // Bitmap subtitles are decoded alongside video and composited before scaling.
                        command.splice(
                            command.indexOf('-t'),
                            0,
                            '-i',
                            s.media.path
                        );
                        command.push(
                            '-filter_complex',
                            `[0:${plan.video.index}]setpts=PTS+${start}/TB[base];[1:${plan.subtitle.index}]scale=${plan.video.width}:${plan.video.height}[sub];[base][sub]overlay=eof_action=pass,setpts=PTS-STARTPTS[vsub]`,
                            '-map',
                            '-0:v',
                            '-map',
                            '[vsub]'
                        );
                    }
                    await this.encodeVideo(
                        s,
                        command,
                        filters,
                        quality,
                        hardware,
                        start,
                        output
                    );
                    return;
                }
                if (plan.audio)
                    command.push(
                        '-c:a',
                        'aac',
                        '-b:a',
                        '128k',
                        '-ac',
                        '2',
                        '-ar',
                        '48000'
                    );
            }
            command.push(
                '-output_ts_offset',
                String(start),
                '-muxdelay',
                '0',
                '-muxpreload',
                '0',
                '-f',
                'mpegts',
                output
            );
            await run(this.ffmpeg, command, s.signal.signal, 60000);
        };
        const begun = Date.now();
        const hardware =
            plan.method === 'transcode' ? await this.encoder() : null;
        try {
            await encode(hardware);
        } catch (error) {
            if (!hardware || s.signal.signal.aborted) throw error;
            this.hardware = Promise.resolve(null);
            await encode(null);
        }
        s.encodingSpeed = length / Math.max(0.001, (Date.now() - begun) / 1000);
    }
    private async encodeVideo(
        s: PlaybackSession,
        command: string[],
        filters: string[],
        quality: { height: number; bitrate: number },
        hardware: string | null,
        start: number,
        output: string
    ): Promise<void> {
        filters.push(
            `scale=w=-2:h='min(${quality.height},ih)'`,
            'fps=30',
            'format=yuv420p'
        );
        if (hardware === 'h264_vaapi') {
            command.unshift(
                '-vaapi_device',
                this.oblecto.config.streaming?.vaapiDevice ??
                    '/dev/dri/renderD128'
            );
            filters.push('format=nv12', 'hwupload');
        }
        if (command.includes('-filter_complex')) {
            const i = command.indexOf('-filter_complex');
            command[i + 1] = command[i + 1].replace(
                '[vsub]',
                `[overlay];[overlay]${filters.join(',')}[vsub]`
            );
        } else command.push('-vf', filters.join(','));
        if (s.plan.hdr) command.push('-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
        command.push('-c:v', hardware ?? 'libx264');
        if (!hardware)
            command.push(
                '-preset',
                'veryfast',
                '-threads',
                '2',
                '-profile:v',
                'main',
                '-sc_threshold',
                '0'
            );
        command.push(
            '-b:v',
            String(quality.bitrate),
            '-maxrate',
            String(quality.bitrate),
            '-bufsize',
            String(quality.bitrate * 2),
            '-g',
            '120',
            '-keyint_min',
            '120',
            '-force_key_frames',
            'expr:gte(t,n_forced*4)',
            '-pix_fmt',
            hardware === 'h264_vaapi' ? 'vaapi' : 'yuv420p'
        );
        if (s.plan.audio)
            command.push(
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                '-ac',
                '2',
                '-ar',
                '48000'
            );
        command.push(
            '-output_ts_offset',
            String(start),
            '-muxdelay',
            '0',
            '-muxpreload',
            '0',
            '-f',
            'mpegts',
            output
        );
        await run(this.ffmpeg, command, s.signal.signal, 60000);
    }
    private async serveAsset(
        s: PlaybackSession,
        asset: string,
        req: Request,
        res: Response
    ): Promise<void> {
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        if (s.remote) {
            await s.remote.client.serve(s.remote.id, asset, req, res);
            return;
        }
        const plan = s.plan;
        const link = (name: string) => `${name}?token=${s.token}`;
        if (asset === 'original') {
            if (s.startupMs === null && req.method === 'GET')
                s.startupMs = Date.now() - s.createdAt;
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
                s.signal.signal
            );
            return;
        }
        if (asset === 'master.m3u8') {
            const tracks =
                plan.subtitle && !plan.burnSubtitles
                    ? [`#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Subtitles",DEFAULT=YES,AUTOSELECT=YES,URI="${link('subtitles.m3u8')}"`]
                    : [];
            const variants = plan.renditions.flatMap((r) => [
                `#EXT-X-STREAM-INF:BANDWIDTH=${r.bitrate + 128000}${plan.video && r.height ? `,RESOLUTION=${Math.floor(((plan.video.width ?? 640) * r.height) / (plan.video.height ?? 360) / 2) * 2}x${r.height}` : ''}${tracks.length ? ',SUBTITLES="subs"' : ''}`,
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
            const lease = await this.cache.acquire(
                `${s.sessionId}/${s.revision}/vtt/${subtitle.index}`,
                (file) =>
                    this.scheduler.submit(
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
        const acquire = (n: number) =>
            this.cache.acquire(
                `${s.sessionId}/${revision}/${segment[1]}/${n}`,
                (file) =>
                    this.scheduler.submit(s.sessionId, s.signal.signal, () =>
                        this.segment(s, segment[1], n, file)
                    )
            );
        const lease = await acquire(index);
        if (s.startupMs === null) s.startupMs = Date.now() - s.createdAt;
        try {
            await sendFile(req, res, lease.path, 'video/mp2t', s.signal.signal);
        } finally {
            lease.release();
        }
        for (let ahead = 1; ahead <= 2; ahead++) {
            if (
                index + ahead >= plan.boundaries.length - 1 ||
                this.scheduler.queued > 0 ||
                s.signal.signal.aborted
            )
                break;
            const prefetch = acquire(index + ahead)
                .then((l) => l.release())
                .catch(() => {});
            s.operations.add(prefetch);
            void prefetch.finally(() => s.operations.delete(prefetch));
        }
    }
}
