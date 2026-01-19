import * as os from 'os';
import * as fs from 'fs';
import { promises as pfs } from 'fs';
import { mkdirp } from 'mkdirp';
import ffmpeg from '../../../submodules/ffmpeg.js';
import logger from '../../../submodules/logger/index.js';
import { MediaSession } from '../MediaSession.js';
import { FfmpegConfig } from '../utils/FfmpegConfig.js';
import { DirectHttpStreamSession } from './DirectHttpStreamer.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { FfmpegCommand } from 'fluent-ffmpeg';
import type { Response } from 'express';
import type { Streamer, MediaSessionOptions, StreamDestination } from '../types.js';

const PLAYLIST_WAIT_TIMEOUT_MS = 15000;
const PLAYLIST_POLL_INTERVAL_MS = 100;

/**
 * HLS streaming session using FFmpeg segmentation
 * 
 * Creates manifest and segment files for HTTP Live Streaming.
 */
export class HlsStreamSession extends MediaSession {
    public segmenterStarted: boolean = false;
    public segmenterError: Error | null = null;
    public readonly segmentDir: string;
    public readonly segmentTemplate: string;
    public readonly playlistPath: string;
    public readonly maxSegments: number = 6;

    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        // Copy streams if codecs already match target
        if (this.targetVideoCodecs.includes(this.file.videoCodec ?? '')) {
            this.videoCodec = 'copy';
        }

        if (this.targetAudioCodecs.includes(this.file.audioCodec ?? '')) {
            this.audioCodec = 'copy';
        }

        // Setup segment directory
        this.segmentDir = `${os.tmpdir()}/oblecto/sessions/${this.sessionId}`;
        this.segmentTemplate = `${this.segmentDir}/%03d.ts`;
        this.playlistPath = `${this.segmentDir}/index.m3u8`;

        mkdirp.sync(this.segmentDir);

        this.initializeFfmpeg();
    }

    /**
     * Initialize the FFmpeg process for HLS segmentation
     */
    protected initializeFfmpeg(): void {
        const videoCodec = this.videoCodec === 'copy'
            ? 'copy'
            : FfmpegConfig.getVideoCodec(this.videoCodec, this.oblecto.config);

        const hlsOptions = FfmpegConfig.getHlsOptions(
            this.segmentDir,
            this.segmentTemplate,
            `/HLS/${this.sessionId}/segment/`,
            this.maxSegments
        );

        this.process = ffmpeg(this.file.path as string)
            .format('hls')
            .videoCodec(videoCodec)
            .audioCodec(this.audioCodec ?? 'aac')
            .seekInput(this.offset)
            .outputOptions(hlsOptions)
            .output(this.playlistPath)
            .on('start', (cmd) => {
                logger.info(`HlsSession ${this.sessionId} started: ${cmd}`);
            })
            .on('error', (error) => {
                this.segmenterError = error as Error;
                logger.error(`HlsSession ${this.sessionId} error:`, error);
            })
            .on('end', () => {
                logger.info(`HlsSession ${this.sessionId} segmenter ended`);
            });
    }

    async endSession(): Promise<void> {
        super.endSession();

        // Cleanup segment directory
        try {
            await pfs.rm(this.segmentDir, { recursive: true, force: true });
        } catch (error) {
            logger.error(`HlsSession ${this.sessionId} cleanup error:`, error);
        }
    }

    /**
     * Start the FFmpeg segmenter
     */
    startSegmenter(): void {
        if (!this.process) return;
        if (this.segmenterStarted) return;

        this.segmenterStarted = true;
        (this.process as FfmpegCommand).run();
    }

    /**
     * Wait for the playlist file to be created
     */
    async waitForPlaylist(): Promise<void> {
        const deadline = Date.now() + PLAYLIST_WAIT_TIMEOUT_MS;

        while (true) {
            if (this.segmenterError) {
                throw this.segmenterError;
            }

            try {
                await pfs.access(this.playlistPath, fs.constants.F_OK);
                return;
            } catch {
                if (Date.now() >= deadline) {
                    throw new Error('Timeout waiting for HLS playlist');
                }
            }

            await new Promise(resolve => setTimeout(resolve, PLAYLIST_POLL_INTERVAL_MS));
        }
    }

    /**
     * Send the playlist file to a response
     */
    async sendPlaylistFile(res: Response | NodeJS.WritableStream): Promise<void> {
        this.startTimeout();
        this.startSegmenter();
        await this.waitForPlaylist();

        if ('writeHead' in res && typeof res.writeHead === 'function') {
            res.writeHead(200, { 'Content-Type': 'application/x-mpegURL' });
        }

        const stream = fs.createReadStream(this.playlistPath);
        stream.on('error', (error) => {
            logger.error(`HlsSession ${this.sessionId} playlist read error:`, error);
        });
        stream.pipe(res as NodeJS.WritableStream);
    }

    /**
     * Stream a segment file
     */
    async streamSegment(req: unknown, res: unknown, segmentId: number): Promise<void> {
        this.clearTimeout();
        this.startSegmenter();

        const response = res as Response;

        response.on('close', () => {
            this.startTimeout();
        });

        const segmentPath = `${this.segmentDir}/${String(segmentId).padStart(3, '0')}.ts`;

        await DirectHttpStreamSession.handleHttpStream(req as any, response, segmentPath);
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        this.destinations.push(destination);

        destination.stream.on('close', () => {
            const index = this.destinations.indexOf(destination);
            if (index > -1) {
                this.destinations.splice(index, 1);
            }
        });
    }

    async startStream(): Promise<void> {
        await super.startStream();

        for (const { stream } of this.destinations) {
            await this.sendPlaylistFile(stream as Response);
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
