import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Op, type WhereOptions } from 'sequelize';

import { File, type Segment } from '../../models/file.js';
import { Episode } from '../../models/episode.js';
import { Movie } from '../../models/movie.js';
import logger from '../../submodules/logger/index.js';
import { parseChapters, segmentsFromChapters } from './chapters.js';
import { detectSharedSegments, fingerprint, fingerprintRegions, type EpisodePrint } from './fingerprint.js';
import { runBinary } from './process.js';
import { generateTrickplay, type VideoStream } from './trickplay.js';

import type Oblecto from '../oblecto/index.js';

type Probe = {
    duration: number;
    chapters: unknown;
    video: VideoStream | null;
};

type SeasonKey = { seriesId: number; season: string };

// Files shorter than this have no intro or credits worth finding
const MIN_SEGMENT_DURATION = 5 * 60;

const local = (file: File): boolean => Boolean(file.path) && (!file.host || file.host === 'local');

/**
 * Works out what playback needs beyond the streams: chapters, thumbnails for seeking, and the
 * intros, recaps, previews and credits a viewer may skip. Runs as low-priority queue jobs: one per
 * file, and one per season, since intros and credits are found by comparing a season's episodes.
 */
export default class MediaAnalyser {
    private pending = new Set<string>();
    private signal = new AbortController();
    private running = new Set<Promise<void>>();
    private runningSeasons = new Set<string>();
    private dirtySeasons = new Set<string>();
    private chromaprint?: Promise<boolean>;

    constructor(private oblecto: Oblecto) {
        oblecto.queue.registerJob('analyseFile', async (fileId: number) => {
            try { await this.run(() => this.analyseFile(fileId)); }
            finally { this.pending.delete(`file:${fileId}`); }
        });
        oblecto.queue.registerJob('detectSeasonSegments', async (key: SeasonKey) => {
            const id = `season:${key.seriesId}:${key.season}`;
            this.runningSeasons.add(id);
            try { await this.run(() => this.detectSeasonSegments(key)); }
            finally {
                this.runningSeasons.delete(id);
                this.pending.delete(id);
                if (this.dirtySeasons.delete(id)) this.queueSeason(key.seriesId, key.season);
            }
        });
    }

    private async run(work: () => Promise<void>): Promise<void> {
        if (this.signal.signal.aborted) return;
        const task = work();
        this.running.add(task);
        try { await task; }
        finally { this.running.delete(task); }
    }

    /** Cancel external processes and let active jobs finish before the database closes. */
    async close(): Promise<void> {
        this.signal.abort();
        this.pending.clear();
        await Promise.allSettled([...this.running]);
    }

    private get settings(): { trickplay: boolean; interval: number; segments: boolean } {
        const streaming = this.oblecto.config.streaming;
        const interval = Number(streaming?.trickplayInterval);

        return {
            trickplay: streaming?.trickplay !== false,
            interval: Number.isInteger(interval) && interval >= 1 && interval <= 60 ? interval : 10,
            segments: streaming?.detectSegments !== false
        };
    }

    private get ffmpeg(): string {
        return this.oblecto.config.ffmpeg.pathFFmpeg || 'ffmpeg';
    }

    private get ffprobe(): string {
        return this.oblecto.config.ffmpeg.pathFFprobe || 'ffprobe';
    }

    /** Where a file's thumbnail sheets are kept. */
    trickplayDirectory(fileId: number): string {
        const root = this.oblecto.config.assets.trickplayLocation || '/etc/oblecto/assets/trickplay/';

        return path.join(root, String(fileId));
    }

    /** Path of one thumbnail sheet, or null when the file has none or the index is out of range. */
    trickplaySheet(file: File, index: number): string | null {
        const info = file.trickplay;

        if (!info || !Number.isSafeInteger(index) || index < 0 || index >= info.sheets) return null;

        return path.join(this.trickplayDirectory(file.id), `${index}.jpg`);
    }

    /** Queue analysis of a file once, however often it is asked for before it runs. */
    queueFile(file: File | number): void {
        const id = typeof file === 'number' ? file : file.id;

        if (this.signal.signal.aborted || this.pending.has(`file:${id}`)) return;
        this.pending.add(`file:${id}`);
        this.oblecto.queue.lowPriorityJob('analyseFile', id);
    }

    private queueSeason(seriesId: number, season: string): void {
        const key = `season:${seriesId}:${season}`;

        if (this.signal.signal.aborted) return;
        if (this.pending.has(key)) {
            // A newly analysed file must be reconsidered after a season already being
            // compared, without letting two workers compare that season at once.
            if (this.runningSeasons.has(key)) this.dirtySeasons.add(key);
            return;
        }
        this.pending.add(key);
        this.oblecto.queue.lowPriorityJob('detectSeasonSegments', { seriesId, season });
    }

    /**
     * Queue analysis of every file that is missing something.
     * @param kind - Movie files or episode files
     */
    async collectAll(kind: 'movies' | 'episodes'): Promise<void> {
        const { trickplay, segments } = this.settings;
        const missing: WhereOptions<File>[] = [{ chapters: null }];

        if (trickplay) missing.push({ trickplay: null });
        if (segments) missing.push({ segments: null });

        const files = await File.findAll({
            attributes: ['id'],
            where: { [Op.or]: missing, [Op.and]: [{ [Op.or]: [{ host: 'local' }, { host: null }, { host: '' }] }] } as WhereOptions<File>,
            include: [
                {
                    model: kind === 'movies' ? Movie : Episode,
                    attributes: ['id'],
                    required: true,
                    through: { attributes: [] }
                }
            ]
        });

        logger.info(`Analysing playback markers for ${files.length} ${kind === 'movies' ? 'movie' : 'episode'} files`);
        for (const file of files) this.queueFile(file.id);
    }

    private async probe(source: string): Promise<Probe> {
        const args = ['-v', 'error', '-show_chapters', '-show_format', '-show_streams', '-select_streams', 'v', '-of', 'json', source];
        const output = await runBinary(this.ffprobe, args, this.signal.signal, 2 * 60 * 1000);
        const data = JSON.parse(output.toString()) as {
            format?: { duration?: string };
            chapters?: unknown;
            streams?: (VideoStream & { disposition?: { attached_pic?: number } })[];
        };
        const videos = (data.streams ?? []).filter(stream => !stream.disposition?.attached_pic && stream.width && stream.height);
        const video = videos.sort((a, b) => (b.width! * b.height!) - (a.width! * a.height!))[0] ?? null;

        return {
            duration: Number(data.format?.duration),
            chapters: data.chapters,
            video
        };
    }

    /**
     * Fill in whatever a file is missing: chapters, thumbnail sheets and, for a movie, the segments
     * its chapter titles name. An episode's segments are found with the rest of its season.
     * @param fileId - The file
     */
    async analyseFile(fileId: number): Promise<void> {
        const file = await File.findByPk(fileId, { include: [{ model: Episode, attributes: ['id', 'SeriesId', 'airedSeason'] }, { model: Movie, attributes: ['id'] }] });

        if (!file || !local(file)) return;

        const { trickplay, interval, segments } = this.settings;
        const needsTrickplay = trickplay && !file.trickplay;
        const isMovie = (file.Movies ?? []).length > 0;

        if (file.chapters && !needsTrickplay && (!segments || file.segments || !isMovie)) {
            this.queueSeasons(file);
            return;
        }

        const probe = await this.probe(file.path!);
        const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : Number(file.duration);
        const chapters = file.chapters ?? parseChapters(probe.chapters, duration);
        const changes: Partial<Pick<File, 'chapters' | 'segments' | 'trickplay' | 'duration'>> = {};

        if (!file.chapters) changes.chapters = chapters;
        if (!(Number(file.duration) > 0) && duration > 0) changes.duration = duration;
        if (segments && isMovie && !file.segments) changes.segments = segmentsFromChapters(chapters);

        if (needsTrickplay && probe.video && duration > 0) {
            try {
                changes.trickplay = await generateTrickplay({
                    ffmpeg: this.ffmpeg,
                    source: file.path!,
                    duration,
                    video: probe.video,
                    directory: this.trickplayDirectory(file.id),
                    interval,
                    signal: this.signal.signal
                });
            } catch (error) {
                logger.warn(`Could not make seek thumbnails for ${file.path}: ${(error as Error).message}`);
            }
        }

        if (this.signal.signal.aborted) return;
        const { segments: detected, ...metadata } = changes;
        if (Object.keys(metadata).length) await file.update(metadata);
        if (detected !== undefined) {
            // An administrator may have corrected the ranges while FFmpeg was running.
            await File.update({ segments: detected }, { where: { id: file.id, segments: null } });
        }
        this.queueSeasons(file);
    }

    private queueSeasons(file: File): void {
        if (!this.settings.segments) return;

        for (const episode of file.Episodes ?? []) {
            if (episode.SeriesId) this.queueSeason(episode.SeriesId, String(episode.airedSeason));
        }
    }

    /** Whether this FFmpeg can fingerprint audio. Asked once. */
    private canFingerprint(): Promise<boolean> {
        this.chromaprint ??= runBinary(this.ffmpeg, ['-hide_banner', '-muxers'], this.signal.signal, 30000)
            .then(output => {
                const available = /\bchromaprint\b/.test(output.toString());

                if (!available) logger.warn('FFmpeg was built without chromaprint, so intros and credits are only found from chapter titles');

                return available;
            })
            .catch(() => false);

        return this.chromaprint;
    }

    /**
     * Find segments for the episodes of a season that have none yet. Chapter titles come first;
     * where they name no intro or credits, the episodes' audio is compared with their neighbours'.
     * An episode alone in its season keeps waiting (unless its chapters name segments), so it is
     * looked at again when the next episode arrives.
     */
    async detectSeasonSegments({ seriesId, season }: SeasonKey): Promise<void> {
        if (!this.settings.segments) return;

        const episodes = await Episode.findAll({
            where: { SeriesId: seriesId, airedSeason: season },
            attributes: ['id', 'airedEpisodeNumber'],
            include: [
                {
                    model: File,
                    attributes: ['id', 'path', 'host', 'duration', 'chapters', 'segments'],
                    through: { attributes: [] }
                }
            ]
        });
        const ordered = episodes
            .sort((a, b) => Number(a.airedEpisodeNumber) - Number(b.airedEpisodeNumber) || a.id - b.id)
            .flatMap(episode => ((episode.get('Files') ?? []) as File[]).filter(file => local(file) && file.chapters !== null));
        const files = [...new Map(ordered.map(file => [file.id, file])).values()];
        const targets = files.filter(file => file.segments === null);

        if (!targets.length) return;

        const fromChapters = new Map(targets.map(file => [file.id, segmentsFromChapters(file.chapters ?? [])]));
        const comparable = files.filter(file => Number(file.duration) >= MIN_SEGMENT_DURATION);
        let shared = new Map<number, { intro?: [number, number]; credits?: [number, number] }>();
        // Without chromaprint the chapters are all there is to go on, so there is nothing to wait for
        const canFingerprint = await this.canFingerprint();
        let compared = !canFingerprint;

        if (comparable.length >= 2 && canFingerprint) {
            // Only the episodes being decided and their neighbours need fingerprints
            const wanted = new Set<number>();

            comparable.forEach((file, i) => {
                if (file.segments !== null) return;
                for (let j = Math.max(0, i - 2); j <= Math.min(comparable.length - 1, i + 2); j++) wanted.add(comparable[j].id);
            });

            const prints: EpisodePrint[] = [];

            for (const file of comparable) {
                if (!wanted.has(file.id)) continue;
                const print = await this.fingerprintFile(file);

                if (print) prints.push(print);
            }

            shared = detectSharedSegments(prints, new Set(targets.map(file => file.id)));
            compared = prints.length >= 2;
        }

        for (const file of targets) {
            const segments: Segment[] = [...fromChapters.get(file.id)!];
            const found = shared.get(file.id);

            for (const type of ['intro', 'credits'] as const) {
                const range = found?.[type];

                if (!range || segments.some(segment => segment.type === type)) continue;
                segments.push({
                    type,
                    start: range[0],
                    // Chromaprint points summarise audio ahead of their timestamp; the
                    // final matching point precedes the end of the shared audio.
                    end: Math.min(Number(file.duration), range[1] + 1.5),
                    source: 'fingerprint'
                });
            }

            if (!compared && !segments.length && Number(file.duration) >= MIN_SEGMENT_DURATION) continue;
            if (this.signal.signal.aborted) return;
            await File.update({ segments: segments.sort((a, b) => a.start - b.start) }, { where: { id: file.id, segments: null } });
        }
    }

    private async fingerprintFile(file: File): Promise<EpisodePrint | null> {
        const duration = Number(file.duration);
        const regions = fingerprintRegions(duration);

        try {
            return {
                id: file.id,
                duration,
                intro: { offset: regions.intro[0], points: await fingerprint(this.ffmpeg, file.path!, ...regions.intro, this.signal.signal) },
                credits: { offset: regions.credits[0], points: await fingerprint(this.ffmpeg, file.path!, ...regions.credits, this.signal.signal) }
            };
        } catch (error) {
            logger.warn(`Could not fingerprint the audio of ${file.path}: ${(error as Error).message}`);

            return null;
        }
    }

    /**
     * Forget a file's segments and look for them again. Segments set by hand are replaced too.
     * @param file - The file
     */
    async resetSegments(file: File): Promise<void> {
        await file.update({ segments: null });
        this.queueFile(file.id);
    }

    /** Delete what was made for a file that is gone. */
    async removeFile(fileId: number): Promise<void> {
        await fs.rm(this.trickplayDirectory(fileId), { recursive: true, force: true });
    }
}
