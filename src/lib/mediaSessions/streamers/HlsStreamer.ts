import * as os from 'os';
import * as fs from 'fs';
import { promises as pfs } from 'fs';
import { mkdirp } from 'mkdirp';
import ffmpeg from '../../../submodules/ffmpeg.js';
import logger from '../../../submodules/logger/index.js';
import { MediaSession } from '../MediaSession.js';
import { FfmpegConfig } from '../utils/FfmpegConfig.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { FfmpegCommand } from 'fluent-ffmpeg';
import type { Request, Response } from 'express';
import type { Streamer, MediaSessionOptions, StreamDestination } from '../types.js';

const PLAYLIST_WAIT_TIMEOUT_MS = 60000; // 60 seconds for slow transcodes
const PLAYLIST_POLL_INTERVAL_MS = 50;
const SEGMENT_WAIT_TIMEOUT_MS = 30000; // 30 seconds for segments
const HLS_SEGMENT_DURATION_SEC = 4;
const HLS_TIMEOUT_BUFFER_MS = 10000;
const HLS_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * HLS streaming session using FFmpeg segmentation
 *
 * Creates manifest and segment files for HTTP Live Streaming.
 *
 * Unlike other streamers, HLS doesn't use the standard outputStream pipe.
 * Instead, it writes segment files to disk and serves them on-demand.
 */
export class HlsStreamSession extends MediaSession {
    public segmenterStarted: boolean = false;
    public segmenterError: Error | null = null;
    public readonly segmentDir: string;
    public readonly segmentTemplate: string;
    public readonly playlistPath: string;
    public readonly maxSegments: number = 20;
    private readonly maxLeadSegments: number;
    private segmenterPaused: boolean = false;
    private lastRequestedSegmentId: number | null = null;
    private lastGeneratedSegmentId: number | null = null;

    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        // Clear the timeout started by base class - we manage timeouts differently for HLS
        this.clearTimeout();

        // Copy video if codec matches target
        if (this.targetVideoCodecs.includes(this.file.videoCodec ?? '')) {
            this.videoCodec = 'copy';
        }

        // Copy audio if codec matches target
        if (this.targetAudioCodecs.includes(this.file.audioCodec ?? '')) {
            this.audioCodec = 'copy';
        }

        // Setup segment directory
        this.segmentDir = `${os.tmpdir()}/oblecto/sessions/${this.sessionId}`;
        this.segmentTemplate = `${this.segmentDir}/%03d.ts`;
        this.playlistPath = `${this.segmentDir}/index.m3u8`;

        mkdirp.sync(this.segmentDir);

        const configuredLead = this.oblecto.config.streaming?.hlsMaxSegmentLead;
        const leadFromConfig = typeof configuredLead === 'number' && Number.isFinite(configuredLead)
            ? Math.floor(configuredLead)
            : null;

        this.maxLeadSegments = Math.max(0, leadFromConfig ?? (this.maxSegments - 1));

        // Use a timeout based on playlist depth, but allow long pause/idle periods
        const bufferedTimeoutMs = (this.maxSegments * HLS_SEGMENT_DURATION_SEC * 1000) + HLS_TIMEOUT_BUFFER_MS;

        this.timeoutMs = Math.max(bufferedTimeoutMs, HLS_SESSION_IDLE_TIMEOUT_MS);

        this.initializeFfmpeg();

        // Start the timeout with the correct value now
        // FFmpeg will start when playlist is first requested (not here to avoid race conditions)
        this.startTimeout();
    }

    /**
     * Initialize the FFmpeg process for HLS segmentation
     */
    protected initializeFfmpeg(): void {
        const videoCodec = this.videoCodec === 'copy'
            ? 'copy'
            : FfmpegConfig.getVideoCodec(this.videoCodec, this.oblecto.config);

        // Build HLS options - using event type for live-like streaming
        // hls.js will poll for playlist updates as FFmpeg produces segments
        const hlsOptions: string[] = [
            `-hls_time ${HLS_SEGMENT_DURATION_SEC}`,
            `-hls_delete_threshold ${this.maxSegments + 5}`,
            `-hls_list_size ${this.maxSegments / 2}`,
            '-hls_flags delete_segments+independent_segments+temp_file',
            `-hls_base_url /HLS/${this.sessionId}/segment/`,
            `-hls_segment_filename ${this.segmentTemplate}`,
            '-fflags +genpts',
            '-avoid_negative_ts make_zero',
            '-muxpreload 0',
            '-muxdelay 0',
            '-max_interleave_delta 0',
            '-ar 48000',
            '-ac 2',
        ];

        if (videoCodec !== 'copy') {
            hlsOptions.push('-pix_fmt yuv420p');
        }

        // Add hardware acceleration options if configured
        const inputOptions: string[] = [];

        if (this.oblecto.config.transcoding?.hardwareAcceleration) {
            const accel = this.oblecto.config.transcoding.hardwareAccelerator || 'cuda';

            inputOptions.push(`-hwaccel ${accel}`);
        }

        this.process = ffmpeg(this.file.path as string)
            .format('hls')
            .videoCodec(videoCodec)
            .audioCodec(this.audioCodec ?? 'aac')
            .seekInput(this.offset)
            .inputOptions(inputOptions)
            .outputOptions(hlsOptions)
            .output(this.playlistPath)
            .on('start', (cmd) => {
                logger.info(`HlsSession ${this.sessionId} started: ${cmd}`);
            })
            .on('stderr', (line: string) => {
                const match = line.match(/(\d+)\.ts\b/);

                if (!match) return;
                const id = parseInt(match[1], 10);

                console.log(`HlsSession ${this.sessionId} generated segment ${id}: ${line}`);

                if (Number.isNaN(id)) return;
                if (this.lastGeneratedSegmentId === null || id > this.lastGeneratedSegmentId) {
                    this.lastGeneratedSegmentId = id;
                    this.applyLeadLimit();
                }
            })
            .on('error', (error) => {
                this.segmenterError = error as Error;
                logger.error(`HlsSession ${this.sessionId} error:`, error);
            })
            .on('end', () => {
                logger.info(`HlsSession ${this.sessionId} segmenter ended`);
            });
    }

    /**
     * Cleanup segment directory on session end
     */
    endSession(): void {
        super.endSession();

        // Cleanup segment directory asynchronously
        pfs.rm(this.segmentDir, { recursive: true, force: true })
            .catch((error) => {
                logger.error(`HlsSession ${this.sessionId} cleanup error:`, error);
            });
    }

    /**
     * Start the FFmpeg segmenter process
     */
    startSegmenter(): void {
        if (!this.process) return;
        if (this.segmenterStarted) return;

        this.segmenterStarted = true;
        (this.process as FfmpegCommand).run();
    }

    private pauseSegmenter(reason: string = 'lead', lead?: number): void {
        if (!this.process) return;
        if (!this.segmenterStarted) return;
        if (this.segmenterPaused) return;
        this.segmenterPaused = true;
        this.process.kill('SIGSTOP');
        const leadInfo = lead !== undefined ? ` lead=${lead} max=${this.maxLeadSegments}` : '';

        logger.info(`HlsSession ${this.sessionId} segmenter paused (${reason})${leadInfo}`);
    }

    private resumeSegmenter(reason: string = 'lead', lead?: number): void {
        if (!this.process) return;
        if (!this.segmenterStarted) return;
        if (!this.segmenterPaused) return;
        this.segmenterPaused = false;
        this.process.kill('SIGCONT');
        const leadInfo = lead !== undefined ? ` lead=${lead} max=${this.maxLeadSegments}` : '';

        logger.info(`HlsSession ${this.sessionId} segmenter resumed (${reason})${leadInfo}`);
    }

    private onActivityStart(): void {
        this.clearTimeout();
        this.startSegmenter();
    }

    private onActivityEnd(): void {
        this.startTimeout();
    }

    private applyLeadLimit(): void {
        if (this.lastGeneratedSegmentId === null) return;
        if (this.lastRequestedSegmentId === null) return;
        const lead = this.lastGeneratedSegmentId - this.lastRequestedSegmentId;

        if (lead > this.maxLeadSegments) {
            this.pauseSegmenter('lead', lead);
        } else if (this.segmenterPaused) {
            this.resumeSegmenter('lead', lead);
        }
    }

    private async waitForFile(filePath: string, timeoutMs: number, timeoutMessage: string): Promise<void> {
        const deadline = Date.now() + timeoutMs;

        while (true) {
            if (this.segmenterError) {
                throw this.segmenterError;
            }

            try {
                await pfs.access(filePath, fs.constants.F_OK);
                return;
            } catch {
                if (Date.now() >= deadline) {
                    throw new Error(timeoutMessage);
                }
            }

            await new Promise(resolve => setTimeout(resolve, PLAYLIST_POLL_INTERVAL_MS));
        }
    }

    /**
     * Wait for the playlist file to be created
     */
    async waitForPlaylist(): Promise<void> {
        await this.waitForFile(this.playlistPath, PLAYLIST_WAIT_TIMEOUT_MS, 'Timeout waiting for HLS playlist');
    }

    /**
     * Wait for a specific segment file to exist
     * @param segmentId
     * @param segmentPath
     */
    async waitForSegment(segmentId: number, segmentPath: string): Promise<void> {
        const deadline = Date.now() + SEGMENT_WAIT_TIMEOUT_MS;

        while (true) {
            if (this.segmenterError) {
                throw this.segmenterError;
            }

            if (this.lastGeneratedSegmentId !== null && this.lastGeneratedSegmentId >= segmentId) {
                await this.waitForFile(segmentPath, SEGMENT_WAIT_TIMEOUT_MS, `Timeout waiting for segment: ${segmentPath}`);
                return;
            }

            if (Date.now() >= deadline) {
                throw new Error(`Timeout waiting for segment: ${segmentPath}`);
            }

            await new Promise(resolve => setTimeout(resolve, PLAYLIST_POLL_INTERVAL_MS));
        }
    }

    /**
     * Send the playlist file to a response
     * @param res
     */
    async sendPlaylistFile(res: Response): Promise<void> {
        this.onActivityStart();

        try {
            await this.waitForPlaylist();
        } catch (error) {
            logger.error(`HlsSession ${this.sessionId} failed to get playlist:`, error);
            if (!res.headersSent) {
                res.status(503).send('Playlist not ready - transcoding in progress');
            }
            this.onActivityEnd();
            return;
        }

        res.setHeader('Content-Type', 'application/x-mpegURL');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        const stream = fs.createReadStream(this.playlistPath);

        stream.on('error', (error) => {
            logger.error(`HlsSession ${this.sessionId} playlist read error:`, error);
            if (!res.headersSent) {
                res.status(500).send('Error reading playlist');
            }
            this.onActivityEnd();
        });
        stream.on('end', () => {
            this.onActivityEnd();
        });
        stream.pipe(res);
    }

    /**
     * Stream a segment file
     * @param req
     * @param res
     * @param segmentId
     */
    async streamSegment(req: Request, res: Response, segmentId: number): Promise<void> {
        this.onActivityStart();

        console.log(`HlsSession ${this.sessionId} requested segment ${segmentId}`);

        if (this.lastRequestedSegmentId === null || segmentId > this.lastRequestedSegmentId)
            this.lastRequestedSegmentId = segmentId;
        this.applyLeadLimit();

        const segmentPath = `${this.segmentDir}/${String(segmentId).padStart(3, '0')}.ts`;

        try {
            // Wait for segment to be available
            await this.waitForSegment(segmentId, segmentPath);

            const stat = await pfs.stat(segmentPath);

            res.setHeader('Content-Type', 'video/MP2T');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Cache-Control', 'max-age=31536000');

            const stream = fs.createReadStream(segmentPath);

            stream.on('error', (error) => {
                logger.error(`HlsSession ${this.sessionId} segment read error:`, error);
                if (!res.headersSent) {
                    res.status(500).send('Error reading segment');
                }
                this.onActivityEnd();
            });
            stream.on('end', () => {
                this.onActivityEnd();
            });
            stream.pipe(res);
        } catch (error) {
            logger.error(`HlsSession ${this.sessionId} segment ${segmentId} error:`, error);
            this.onActivityEnd();
            if (!res.headersSent) {
                res.status(404).send('Segment not found');
            }
        }
    }

    /**
     * Override addDestination - HLS handles destinations differently
     *
     * For HLS, we just track the destination but don't pipe the outputStream
     * @param destination
     */
    async addDestination(destination: StreamDestination): Promise<void> {
        this.clearTimeout();
        this.destinations.push(destination);

        const handleDisconnect = () => {
            const index = this.destinations.indexOf(destination);

            if (index > -1) {
                this.destinations.splice(index, 1);
            }
            if (this.destinations.length === 0) {
                this.onActivityEnd();
            }
        };

        destination.stream
            .on('finish', handleDisconnect)
            .on('close', handleDisconnect)
            .on('aborted', handleDisconnect)
            .on('error', (err: Error) => {
                logger.error(`HlsSession ${this.sessionId} destination error:`, err);
                handleDisconnect();
            });
    }

    /**
     * Start streaming - for HLS this sends the playlist to all destinations
     */
    async startStream(): Promise<void> {
        this.clearTimeout();

        for (const destination of this.destinations) {
            if (destination.type === 'http') {
                await this.sendPlaylistFile(destination.stream as Response);
            }
        }
    }
}

/**
 * Streamer plugin for HLS streaming
 */
export class HlsStreamer implements Streamer {
    readonly type = 'hls';
    readonly priority = 50;

    canHandle(file: File, options: MediaSessionOptions, oblecto: Oblecto): boolean {
        // Only handle local files
        if (file.host !== 'local') return false;

        // Only if explicitly requested
        return options.streamType === 'hls';
    }

    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession {
        return new HlsStreamSession(file, options, oblecto);
    }
}
