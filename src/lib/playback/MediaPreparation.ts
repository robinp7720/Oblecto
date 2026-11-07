import { promises as fs } from 'node:fs';
import { PlaybackError, type Media, type PlaybackOptions, type PlaybackPlan, type Track } from './types.js';
import { planPlayback } from './planner.js';
import { run, type Scheduler } from './process.js';
import { MetadataCache, waitFor, sourceVersion, preparedMetadata, type PreparedMetadata } from './metadataCache.js';

/** Only the source properties needed to prepare playback; persistence stays with the caller. */
export interface PreparationSource {
    path: string | null;
    host?: string | null;
    duration?: number | null;
    extension?: string | null;
}

export interface PreparationDependencies<Source extends PreparationSource> {
    scheduler: Pick<Scheduler, 'submit' | 'promote'>;
    signal: AbortSignal;
    ffprobe(): string;
    defaultLanguage(): string | undefined;
    loadMetadata(file: Source): Promise<PreparedMetadata | null | undefined>;
    saveMetadata(file: Source, metadata: PreparedMetadata): Promise<void>;
    queueAnalysis(file: Source): void;
    run?: typeof run;
}

/** Shared probing and plan preparation, independent of sessions, HTTP and database models. */
export class MediaPreparation<Source extends PreparationSource> {
    private probes = new Map<string, Promise<Media>>();
    private timelines = new MetadataCache<number[]>();
    private readonly run: typeof run;

    constructor(private readonly dependencies: PreparationDependencies<Source>) {
        this.run = dependencies.run ?? run;
    }

    private get ffprobe(): string {
        return this.dependencies.ffprobe();
    }

    async probe(file: Source, priority = 0): Promise<Media> {
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
        const key = sourceVersion(file.path, stat, this.ffprobe);
        const cached = this.probes.get(key);
        if (cached) {
            if (priority === 0) this.dependencies.scheduler.promote('probe', key);
            return cached;
        }
        const stored = preparedMetadata(await this.dependencies.loadMetadata(file), key);
        if (stored) {
            if (stored.keyframes) {
                const timelineKey = this.timelineKey(stored.media, stored.keyframes.videoIndex, key);
                void this.timelines.get(timelineKey, async () => stored.keyframes!.times);
            }
            if (this.probes.size >= 128) this.probes.delete(this.probes.keys().next().value!);
            this.probes.set(key, Promise.resolve(stored.media));
            return stored.media;
        }
        this.dependencies.queueAnalysis(file);
        let probe = this.probes.get(key);
        if (!probe) {
            probe = this.dependencies.scheduler.submit(
                'probe',
                this.dependencies.signal,
                async () => {
                    const data = JSON.parse(
                        await this.run(
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
                            this.dependencies.signal
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
                },
                priority,
                key
            );
            if (this.probes.size >= 128)
                this.probes.delete(this.probes.keys().next().value!);
            this.probes.set(key, probe);
            void probe.catch(() => this.probes.delete(key));
        }
        return probe;
    }
    private timelineKey(media: Media, videoIndex: number, source: string): string {
        return JSON.stringify([source, videoIndex, media.duration]);
    }
    /** Low-priority library analysis persists complete metadata; playback remains available meanwhile. */
    async analyseFile(file: Source, signal: AbortSignal = this.dependencies.signal): Promise<void> {
        if (!file.path || (file.host && file.host !== 'local')) return;
        const source = sourceVersion(file.path, await fs.stat(file.path), this.ffprobe);
        const stored = preparedMetadata(await this.dependencies.loadMetadata(file), source);
        if (stored && (stored.keyframes || !stored.media.streams.some(track => track.codec_type === 'video' && !track.disposition?.attached_pic))) return;
        const media = await waitFor(this.probe(file, 1), signal);
        const video = media.streams.find(track => track.codec_type === 'video' && !track.disposition?.attached_pic);
        let keyframes = null;
        if (video) {
            try { keyframes = { videoIndex: video.index, times: await this.keyframeTimeline(media, video.index, signal, 1) }; }
            catch (error) { if (signal.aborted) throw error; }
        }
        if (!signal.aborted && sourceVersion(file.path, await fs.stat(file.path), this.ffprobe) === source)
            await this.dependencies.saveMetadata(file, {
                version: 1, source, media, keyframes
            });
    }
    private async keyframeTimeline(media: Media, videoIndex: number, signal: AbortSignal, priority = 0): Promise<number[]> {
        const stat = await fs.stat(media.path);
        const key = this.timelineKey(media, videoIndex, sourceVersion(media.path, stat, this.ffprobe));
        if (priority === 0) this.dependencies.scheduler.promote('keyframes', key);
        return waitFor(this.timelines.get(key, async () => {
            const output = await this.dependencies.scheduler.submit('keyframes', this.dependencies.signal, () => this.run(this.ffprobe, [
                '-v', 'error', '-select_streams', String(videoIndex), '-skip_frame', 'nokey',
                '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', media.path
            ], this.dependencies.signal), priority, key);
            const data = JSON.parse(output) as { frames: Array<{ best_effort_timestamp_time: string }> };
            const times = data.frames.map(frame => Number(frame.best_effort_timestamp_time))
                .filter(time => Number.isFinite(time) && time >= 0 && time < media.duration)
                .sort((a, b) => a - b).filter((time, index, times) => index === 0 || time > times[index - 1]);
            if (!times.length || times[0] > 0.05) throw new Error('No usable keyframe timeline');
            return times;
        }), signal);
    }
    async prepare(
        media: Media,
        options: PlaybackOptions,
        signal: AbortSignal
    ): Promise<PlaybackPlan> {
        const plan = planPlayback(
            media,
            options,
            this.dependencies.defaultLanguage()
        );
        if (plan.videoOperation === 'copy' && plan.method !== 'direct' && plan.video) {
            try {
                const times = await this.keyframeTimeline(media, plan.video.index, signal);
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
                    this.dependencies.defaultLanguage()
                );
            }
        }
        return plan;
    }
}
