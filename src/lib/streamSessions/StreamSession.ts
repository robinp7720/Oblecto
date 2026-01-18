import { EventEmitter } from 'events';
import { v4 } from 'uuid';
import logger from '../../submodules/logger/index.js';
import * as Stream from 'stream';

import type { FfmpegCommand } from 'fluent-ffmpeg';
import type { File } from '../../models/file.js';
import type Oblecto from '../oblecto/index.js';
import type { Request, Response } from 'express';

export type StreamOptions = {
    target: {
        formats: string[];
        videoCodecs: string[];
        audioCodecs: string[];
    };
    offset?: number;
    streamType?: string;
};

export type StreamDestination = {
    type: string;
    stream: Response | Stream.Writable;
    request?: Request;
};

export default class StreamSession extends EventEmitter {
    public oblecto: Oblecto;
    public file: File;
    public sessionId: string;
    public destinations: StreamDestination[];
    public targetFormats: string[];
    public targetVideoCodecs: string[];
    public targetAudioCodecs: string[];
    public format: string;
    public videoCodec: string | null;
    public audioCodec: string | null;
    public process: FfmpegCommand | null;
    public offset: number;
    public paused: boolean;
    public inputStream: Stream.PassThrough;
    public outputStream: Stream.PassThrough;
    public httpHeaders: Record<string, string | number>;
    public httpStatusCode: number;
    public timeoutTime: number;
    public timeout?: NodeJS.Timeout;

    /**
     *
     * @param file - File to stream
     * @param options - Streamer options
     * @param oblecto - Oblecto server instance
     */
    constructor(file: File, options: StreamOptions, oblecto: Oblecto) {
        super();

        logger.info( 'New StreamSession initiating');

        this.oblecto = oblecto;

        this.file = file;
        this.sessionId = v4();
        this.destinations = [];

        this.targetFormats = options.target.formats;
        this.targetVideoCodecs = options.target.videoCodecs;
        this.targetAudioCodecs = options.target.audioCodecs;

        this.format = this.targetFormats[0] || 'mp4';
        this.videoCodec = this.targetVideoCodecs[0] || 'h264';
        this.audioCodec = this.targetAudioCodecs[0] || 'aac';

        this.process = null;
        this.offset = options.offset || 0;
        this.paused = true;

        this.inputStream = new Stream.PassThrough();
        this.outputStream = new Stream.PassThrough();

        this.outputStream.on('pause', () => this.outputPause());
        this.outputStream.on('resume', () => this.outputResume());

        this.outputStream.on('close', () => {
            logger.info( this.sessionId, 'output stream has closed');
            this.endSession();
        });

        this.httpHeaders = {
            'Content-Type': this.getOutputMimetype(),
            'Accept-Ranges': 'none',
        };

        this.httpStatusCode = 200;
        this.timeoutTime = 10000;

        this.startTimeout();
    }

    outputPause(): void {
        this.paused = true;
        logger.info( 'Pausing stream session');
    }
    outputResume(): void {
        this.paused = false;
        logger.info( 'Resuming stream session');
    }

    endSession(): void {
        if (this.process) {
            this.process.kill();
        }

        this.emit('close');
    }

    startTimeout(): void {
        if (this.timeout) this.clearTimeout();

        this.timeout = setTimeout(() => this.onTimeOut(), this.timeoutTime);
    }

    onTimeOut(): void {
        // Some video clients start a new connection before closing the old one.
        // we don't want to kill the session if a client is still connected
        for (const session of this.destinations) {
            if (session) return;
        }

        logger.info( 'StreamSession', this.sessionId, 'has timed out. Destroying output stream');
        this.outputStream.destroy();
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        this.destinations.push(destination);
        this.outputStream.pipe(destination.stream);

        if (destination.type === 'http') {
            const stream = destination.stream as Response;
            stream.setHeader('Content-Type', this.getOutputMimetype());
            stream.setHeader('Transfer-Encoding', 'chunked');
            stream.status(this.httpStatusCode);
        }

        destination.stream
            .on('error', (err: Error) => {
                logger.error( this.sessionId, err);
            })
            .on('close', () => {
                // Remove destination by reference rather than finding index
                const destinationIndex = this.destinations.indexOf(destination);

                if (destinationIndex > -1) {
                    this.destinations.splice(destinationIndex, 1);
                }

                if (!this.destinations.length) {
                    logger.info( this.sessionId, 'last client has disconnected. Setting timeout output stream');
                    this.startTimeout();
                }
            });
    }

    clearTimeout(): void {
        if (this.timeout) clearTimeout(this.timeout);
    }

    async startStream(): Promise<void> {
        this.clearTimeout();
    }

    getOutputMimetype(): string {
        if (this.format === 'mp4')
            return 'video/mp4';

        if (this.format === 'mpegts')
            return 'video/mp2t';

        if (this.format === 'matroska')
            return 'video/x-matroska';

        return 'video';
    }

    getFfmpegVideoCodec(): string {
        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                if (this.videoCodec === 'h264'){
                    return 'h264_nvenc';
                }
            }

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'vaapi') {
                if (this.videoCodec === 'h264'){
                    return 'h264_vaapi';
                }
            }
        }

        const codecs: Record<string, string> = { 'h264': 'libx264' };

        if (codecs[this.videoCodec ?? '']) return codecs[this.videoCodec ?? ''];

        return this.videoCodec ?? 'h264';
    }
}
