import type { StatisticsReport } from '../statistics/accounting.js';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Dependencies } from '../contracts.js';
import { File } from '../../models/file.js';
import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';
import { PlaybackError, validateOptions } from './types.js';
import type { Media, PlaybackOptions, PlaybackPlan, PlaybackTimings } from './types.js';
import { trackOperations } from './planner.js';
import { Scheduler } from './process.js';
import { SegmentCache } from './cache.js';
import { SegmentWindows } from './windows.js';
import { AssetDelivery } from './AssetDelivery.js';
import { SegmentEncoder } from './SegmentEncoder.js';
import { saveProgress } from './progress.js';
import { MediaPreparation } from './MediaPreparation.js';
import logger from '../../submodules/logger/index.js';

type ServiceDependencies = Dependencies<'mediaAnalyser' | 'statistics', 'ffmpeg' | 'streaming' | 'transcoding'>;

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
        res: Response,
        onFirstByte?: () => void
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
    readonly timings: PlaybackTimings = {
        lookupMs: 0,
        statisticsMs: 0,
        probeMs: 0,
        planMs: 0,
        preparationMs: 0,
        firstMediaMs: null,
        firstPlaybackMs: null
    };
    startedMonotonic = performance.now();
    failure: string | null = null;
    bufferingReports = 0;
    encodingSpeed: number | null = null;
    delivery = {
        queueWaitMs: 0, generationMs: 0, bufferedSeconds: 0, rebufferDurationMs: 0
    };
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
        public plan: PlaybackPlan,
        readonly statisticsId: string = randomUUID()
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
    private readonly windows: SegmentWindows;
    private readonly timer: NodeJS.Timeout;
    private readonly idleMs: number;
    private closing = false;
    private lifetime = new AbortController();
    private pendingPeers = new Set<RemotePlayback>();
    private readonly delivery: AssetDelivery;
    private readonly preparation: MediaPreparation<File>;
    private creation = new Set<Promise<PlaybackSession>>();
    remoteFactory?: (host: string) => Promise<RemotePlayback>;
    constructor(readonly oblecto: ServiceDependencies) {
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
        if (config?.encoderMode !== undefined && !['segment', 'window'].includes(config.encoderMode))
            throw new PlaybackError('INVALID_CONFIG', 'Invalid playback encoder mode', 500);
        this.scheduler = new Scheduler(
            config?.encodingConcurrency ?? 2,
            config?.maxQueue ?? 64
        );
        this.preparation = new MediaPreparation<File>({
            scheduler: this.scheduler,
            signal: this.lifetime.signal,
            ffprobe: () => this.ffprobe,
            defaultLanguage: () => this.oblecto.config.streaming?.defaultTargetLanguageCode,
            loadMetadata: async file => {
                // Preparation data is excluded from ordinary library queries and DTOs.
                if (file.playbackMetadata !== undefined || !(file instanceof File)) return file.playbackMetadata;
                return (await File.unscoped().findByPk(file.id, { attributes: ['playbackMetadata'] }))?.playbackMetadata;
            },
            saveMetadata: async (file, playbackMetadata) => { await file.update({ playbackMetadata }); },
            queueAnalysis: file => { this.oblecto.mediaAnalyser?.queueFile(file); }
        });
        this.cache = new SegmentCache(
            config?.cacheBytes ?? 10 * 1024 ** 3,
            config?.cacheDirectory
        );
        this.windows = new SegmentWindows(this.cache);
        const encoder = new SegmentEncoder({
            cache: this.cache,
            ffmpeg: () => this.ffmpeg,
            transcoding: () => this.oblecto.config.transcoding,
            vaapiDevice: () => this.oblecto.config.streaming?.vaapiDevice
        });
        this.delivery = new AssetDelivery({
            cache: this.cache,
            scheduler: this.scheduler,
            windows: this.windows,
            encoder,
            ffmpeg: () => this.ffmpeg,
            encoderMode: () => this.oblecto.config.streaming?.encoderMode,
            trickplaySheet: (file, index) => this.oblecto.mediaAnalyser?.trickplaySheet(file, index)
        });
        this.idleMs = config?.idleTimeoutMs ?? 30 * 60 * 1000;
        this.timer = setInterval(() => {
            for (const s of this.sessions.values())
                if (Date.now() - s.updatedAt > this.idleMs)
                    void this.stop(s, 'timeout').catch(() => {});
        }, 30000);
        this.timer.unref();
    }
    get ffmpeg(): string {
        return this.oblecto.config.ffmpeg.pathFFmpeg || 'ffmpeg';
    }
    get ffprobe(): string {
        return this.oblecto.config.ffmpeg.pathFFprobe || 'ffprobe';
    }
    probe(file: File, priority = 0): Promise<Media> {
        return this.preparation.probe(file, priority);
    }
    analyseFile(file: File, signal: AbortSignal = this.lifetime.signal): Promise<void> {
        return this.preparation.analyseFile(file, signal);
    }
    prepare(media: Media, options: PlaybackOptions, signal: AbortSignal): Promise<PlaybackPlan> {
        return this.preparation.prepare(media, options, signal);
    }
    create(
        file: File,
        owner: string,
        userId: number | null,
        options: PlaybackOptions = {},
        statisticsId: string = randomUUID(),
        requestedAt = performance.now()
    ): Promise<PlaybackSession> {
        const valid = validateOptions(options);
        const promise = (async () => {
            const statisticsAt = performance.now();
            await this.oblecto.statistics?.begin(statisticsId, userId, file, owner.startsWith('emby:') ? 'jellyfin' : 'web', valid.position);
            try {
                const statisticsMs = performance.now() - statisticsAt;
                const session = await this.createSession(file, owner, userId, valid, statisticsId);
                session.startedMonotonic = requestedAt;
                session.createdAt = Date.now() - (performance.now() - requestedAt);
                session.timings.lookupMs = statisticsAt - requestedAt;
                session.timings.statisticsMs = statisticsMs;
                session.timings.preparationMs = performance.now() - requestedAt;
                return session;
            } catch (error) {
                await this.oblecto.statistics?.failure(statisticsId, error instanceof PlaybackError ? error.code : 'PREPARATION_FAILED');
                await this.oblecto.statistics?.end(statisticsId, 'failed');
                throw error;
            }
        })();
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
        options: PlaybackOptions,
        statisticsId: string
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
                    data.plan,
                    statisticsId
                );
                session.remote = { client, id: data.sessionId };
            } catch (error) {
                client.close();
                throw error;
            } finally {
                this.pendingPeers.delete(client);
            }
        } else {
            const probeAt = performance.now();
            const media = await this.probe(file);
            const probeMs = performance.now() - probeAt;
            const planAt = performance.now();
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
                plan,
                statisticsId
            );
            session.timings.probeMs = probeMs;
            session.timings.planMs = performance.now() - planAt;
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
            timings: { ...s.timings },
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
            operations: trackOperations(s.plan),
            subtitleUrl:
                s.plan.subtitle && !s.plan.burnSubtitles
                    ? url('subtitle.vtt')
                    : null,
            ...this.markers(s, url)
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
                await this.oblecto.statistics?.revise(s.statisticsId, s.position, s.revision, s.plan.method);
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
        data: StatisticsReport & { revision: number }
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
        data: StatisticsReport & { revision: number }
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
        if (Number.isFinite(data.bufferedSeconds) && data.bufferedSeconds! >= 0 && data.bufferedSeconds! <= s.media.duration)
            s.delivery.bufferedSeconds = data.bufferedSeconds!;
        if (Number.isFinite(data.rebufferDurationMs) && data.rebufferDurationMs! >= s.delivery.rebufferDurationMs && data.rebufferDurationMs! <= 7 * 86400000)
            s.delivery.rebufferDurationMs = data.rebufferDurationMs!;
        if (s.timings.firstPlaybackMs === null && Number.isFinite(data.firstPlaybackMs) && data.firstPlaybackMs! >= 0 && data.firstPlaybackMs! <= 24 * 60 * 60 * 1000) {
            s.timings.firstPlaybackMs = data.firstPlaybackMs!;
        }
        if (s.remote)
            await s.remote.client.request('heartbeat', {sessionId: s.remote.id});
        await this.persist(s, data.position, data.revision);
        await this.oblecto.statistics?.report(s.statisticsId, data, s.media.duration, s.plan.method);
        if (data.failed === true) await this.oblecto.statistics?.failure(s.statisticsId, 'CLIENT_FAILED');
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
    async stop(s: PlaybackSession, reason = 'stopped'): Promise<void> {
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
        await this.oblecto.statistics?.end(s.statisticsId, reason);
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
            [...this.sessions.values()].map((s) => this.stop(s, 'shutdown'))
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
                // Named, so the status page can say what is playing.
                file: {
                    id: s.file.id,
                    name: s.file.name,
                    extension: s.file.extension
                },
                method: s.plan.method,
                reason: s.plan.reason,
                position: s.position,
                startupMs: s.startupMs,
                timings: { ...s.timings },
                bufferingReports: s.bufferingReports,
                encodingSpeed: s.encodingSpeed,
                delivery: { ...s.delivery },
                operations: trackOperations(s.plan),
                failure: s.failure,
                queueDepth: this.scheduler.queued,
                activeEncoders: this.scheduler.active,
                cacheBytes: this.cache.bytes,
                output: {
                    format:
                        s.plan.method === 'direct' ? s.media.container : 'hls',
                    videoCodec:
                        trackOperations(s.plan).video === 'encode'
                            ? 'h264'
                            : s.plan.video?.codec_name,
                    audioCodec:
                        trackOperations(s.plan).audio === 'encode'
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
        // Seek thumbnails do not depend on the selected tracks, so any revision of the session serves them
        const sheet = /^trickplay-(\d+)\.jpg$/.exec(asset);
        if (sheet && !s.signal.signal.aborted) {
            s.touch();
            return this.delivery.serveTrickplay(s, Number(sheet[1]), req, res);
        }
        if (revision !== s.revision || s.signal.signal.aborted)
            return Promise.reject(
                new PlaybackError(
                    'STALE_REVISION',
                    'Playback output has changed',
                    409
                )
            );
        s.touch();
        const promise = this.delivery.serve(s, asset, req, res).catch((error) => {
            if (!s.signal.signal.aborted && !res.destroyed) {
                s.failure =
                    error instanceof PlaybackError
                        ? error.code
                        : 'ENCODING_FAILED';
                void this.oblecto.statistics?.failure(s.statisticsId, s.failure);
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
    /** Chapters, skippable segments and seek thumbnails of the session's file. */
    markers(s: PlaybackSession, url: (asset: string) => string) {
        const trickplay = s.remote ? null : s.file.trickplay;
        return {
            chapters: s.remote ? [] : (s.file.chapters ?? []),
            segments: s.remote ? [] : (s.file.segments ?? []).map(({ type, start, end }) => ({
                type,
                start,
                end
            })),
            trickplay: trickplay
                ? {
                    width: trickplay.width,
                    height: trickplay.height,
                    tileWidth: trickplay.tileWidth,
                    tileHeight: trickplay.tileHeight,
                    interval: trickplay.interval,
                    count: trickplay.count,
                    sheets: Array.from({ length: trickplay.sheets }, (_, i) => url(`trickplay-${i}.jpg`))
                }
                : null
        };
    }
}
