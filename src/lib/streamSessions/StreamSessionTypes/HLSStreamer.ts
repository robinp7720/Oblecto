import StreamSession, { StreamOptions, StreamDestination } from '../StreamSession.js';
import { mkdirp } from 'mkdirp';
import * as os from 'os';
import ffmpeg from '../../../submodules/ffmpeg.js';
import logger from '../../../submodules/logger/index.js';
import * as fs from 'fs';
import { promises as pfs } from 'fs';
import DirectHttpStreamSession from './DirectHttpStreamSession.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { FfmpegCommand } from 'fluent-ffmpeg';

const PLAYLIST_WAIT_TIMEOUT_MS = 15000;
const PLAYLIST_POLL_INTERVAL_MS = 100;

export default class HLSStreamer extends StreamSession {
    public segmenterStarted: boolean;
    public segmenterError: Error | null;
    public playlistPath: string;
    public segmentDir: string;
    public segmentTemplate: string;
    public maxSegments: number;
    public process: FfmpegCommand | null;

    /**
     * @param file - File to be streamed
     * @param options - Options for Media streamer
     * @param oblecto - Oblecto server instance
     */
    constructor(file: File, options: StreamOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        this.segmenterStarted = false;
        this.segmenterError = null;
        this.maxSegments = 6;

        if (this.targetVideoCodecs.includes(this.file.videoCodec ?? '')) {
            this.videoCodec = 'copy';
        }

        if (this.targetAudioCodecs.includes(this.file.audioCodec ?? '')) {
            this.audioCodec = 'copy';
        }

        this.segmentDir = `${os.tmpdir()}/oblecto/sessions/${this.sessionId}`;
        this.segmentTemplate = `${this.segmentDir}/%03d.ts`;
        this.playlistPath = `${this.segmentDir}/index.m3u8`;

        mkdirp.sync(this.segmentDir);

        this.process = ffmpeg(this.file.path as string)
            .format('hls')
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec ?? 'aac')
            .seekInput(this.offset)
            .outputOptions([
                '-hls_time', '4',
                '-hls_list_size', `${this.maxSegments}`,
                '-hls_flags', 'delete_segments+independent_segments',
                '-hls_playlist_type', 'event',
                '-hls_base_url', `/HLS/${this.sessionId}/segment/`,
                '-hls_segment_filename', this.segmentTemplate
            ])
            .output(this.playlistPath)
            .on('start', (cmd) => {
                logger.info(this.sessionId, cmd);
            })
            .on('error', (error) => {
                this.segmenterError = error as Error;
                logger.error(this.sessionId, error);
            })
            .on('end', () => {
                logger.info(this.sessionId, 'HLS segmenter ended');
            });
    }

    async endSession(): Promise<void> {
        super.endSession();

        try {
            await pfs.rm(this.segmentDir, { recursive: true, force: true });
        } catch (error) {
            logger.error(this.sessionId, error as Error);
        }
    }

    startSegmenter(): void {
        if (!this.process) return;
        if (this.segmenterStarted) return;

        this.segmenterStarted = true;
        this.process.run();
    }

    async waitForPlaylist(): Promise<void> {
        const deadline = Date.now() + PLAYLIST_WAIT_TIMEOUT_MS;

        while (true) {
            if (this.segmenterError) {
                throw this.segmenterError;
            }

            try {
                await pfs.access(this.playlistPath, fs.constants.F_OK);
                return;
            } catch (error) {
                if (Date.now() >= deadline) {
                    throw error;
                }
            }

            await new Promise(resolve => setTimeout(resolve, PLAYLIST_POLL_INTERVAL_MS));
        }
    }

    async sendPlaylistFile(res: fs.WriteStream | NodeJS.WritableStream & { writeHead?: (code: number, headers: Record<string, string>) => void }): Promise<void> {
        this.startTimeout();

        this.startSegmenter();
        await this.waitForPlaylist();

        if ('writeHead' in res && typeof res.writeHead === 'function') {
            res.writeHead(200, { 'Content-Type': 'application/x-mpegURL' });
        }

        const stream = fs.createReadStream(this.playlistPath);
        stream.on('error', (error) => {
            logger.error(this.sessionId, error as Error);
        });
        stream.pipe(res);
    }

    async streamSegment(req: unknown, res: unknown, segmentId: number): Promise<void> {
        this.clearTimeout();

        this.startSegmenter();

        const response = res as NodeJS.WritableStream & { on: (event: 'close', cb: () => void) => void };

        response.on('close', () => {
            this.startTimeout();
        });

        const segmentPath = `${this.segmentDir}/${('000' + segmentId).slice(-3)}.ts`;

        DirectHttpStreamSession.httpStreamHandler(req as any, res as any, segmentPath);
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        this.destinations.push(destination);

        destination.stream.on('close', () => {
            const destinationIndex = this.destinations.indexOf(destination);

            if (destinationIndex > -1) {
                this.destinations.splice(destinationIndex, 1);
            }
        });
    }

    async startStream(): Promise<void> {
        await super.startStream();

        for (const { stream } of this.destinations) {
            await this.sendPlaylistFile(stream as any);
        }
    }
}
