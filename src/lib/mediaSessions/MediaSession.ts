import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import * as Stream from 'stream';
import logger from '../../submodules/logger/index.js';
import { getMimeType } from './utils/MimeTypes.js';

import type { File } from '../../models/file.js';
import type Oblecto from '../oblecto/index.js';
import type { FfmpegCommand } from 'fluent-ffmpeg';
import type { Response } from 'express';
import type {
    MediaSessionOptions,
    StreamDestination,
    MediaSessionState,
    MediaSessionInfo,
    MediaSessionEvents,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Base class for all media streaming sessions.
 * 
 * A MediaSession represents an active streaming session for a media file.
 * It manages the lifecycle of the stream, destinations, and cleanup.
 */
export class MediaSession extends EventEmitter {
    public readonly sessionId: string;
    public readonly oblecto: Oblecto;
    public readonly file: File;

    // Target codecs/formats
    public readonly targetFormats: string[];
    public readonly targetVideoCodecs: string[];
    public readonly targetAudioCodecs: string[];

    // Selected output configuration
    public format: string;
    public videoCodec: string | null;
    public audioCodec: string | null;

    // Stream state
    public offset: number;
    protected state: MediaSessionState = 'idle';
    protected destinations: StreamDestination[] = [];

    // Streams
    protected inputStream: Stream.PassThrough;
    protected outputStream: Stream.PassThrough;
    protected process: FfmpegCommand | null = null;

    // HTTP configuration
    protected httpHeaders: Record<string, string | number>;
    protected httpStatusCode: number = 200;

    // Timeout management
    protected timeoutMs: number = DEFAULT_TIMEOUT_MS;
    protected timeoutHandle?: NodeJS.Timeout;

    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super();

        this.sessionId = uuid();
        this.oblecto = oblecto;
        this.file = file;

        // Store target preferences
        this.targetFormats = options.target.formats;
        this.targetVideoCodecs = options.target.videoCodecs;
        this.targetAudioCodecs = options.target.audioCodecs;

        // Select output configuration (subclasses may override)
        this.format = this.targetFormats[0] || 'mp4';
        this.videoCodec = this.targetVideoCodecs[0] || 'h264';
        this.audioCodec = this.targetAudioCodecs[0] || 'aac';

        this.offset = options.offset || 0;

        // Initialize streams
        this.inputStream = new Stream.PassThrough();
        this.outputStream = new Stream.PassThrough();

        this.setupOutputStreamHandlers();

        // Default HTTP headers
        this.httpHeaders = {
            'Content-Type': this.getOutputMimeType(),
            'Accept-Ranges': 'none',
        };

        this.startTimeout();

        logger.info(`MediaSession ${this.sessionId} created for file ${file.id}`);
    }

    /**
     * Get the seek mode for this session
     */
    get seekMode(): 'client' | 'server' {
        return 'server';
    }

    /**
     * Get session info for external consumers
     */
    getInfo(): MediaSessionInfo {
        return {
            sessionId: this.sessionId,
            state: this.state,
            file: {
                id: this.file.id,
                path: this.file.path,
                videoCodec: this.file.videoCodec,
                audioCodec: this.file.audioCodec,
            },
            output: {
                format: this.format,
                videoCodec: this.videoCodec,
                audioCodec: this.audioCodec,
            },
            seekMode: this.seekMode,
            destinationCount: this.destinations.length,
        };
    }

    /**
     * Setup handlers for the output stream
     */
    protected setupOutputStreamHandlers(): void {
        this.outputStream.on('pause', () => this.onOutputPause());
        this.outputStream.on('resume', () => this.onOutputResume());
        this.outputStream.on('close', () => {
            logger.info(`MediaSession ${this.sessionId} output stream closed`);
            this.endSession();
        });
    }

    /**
     * Add a destination for the stream output
     */
    async addDestination(destination: StreamDestination): Promise<void> {
        this.clearTimeout();
        this.destinations.push(destination);

        // Pipe output to this destination
        this.outputStream.pipe(destination.stream);

        // Setup HTTP response headers if applicable
        if (destination.type === 'http') {
            const res = destination.stream as Response;
            res.setHeader('Content-Type', this.getOutputMimeType());
            res.setHeader('Transfer-Encoding', 'chunked');
            res.status(this.httpStatusCode);
        }

        // Handle destination cleanup
        destination.stream
            .on('error', (err: Error) => {
                logger.error(`MediaSession ${this.sessionId} destination error:`, err);
            })
            .on('close', () => {
                this.removeDestination(destination);
            });
    }

    /**
     * Remove a destination
     */
    protected removeDestination(destination: StreamDestination): void {
        const index = this.destinations.indexOf(destination);
        if (index > -1) {
            this.destinations.splice(index, 1);
        }

        if (this.destinations.length === 0) {
            logger.info(`MediaSession ${this.sessionId} last destination disconnected, starting timeout`);
            this.startTimeout();
        }
    }

    /**
     * Start streaming - subclasses should override this
     */
    async startStream(): Promise<void> {
        this.clearTimeout();
        this.state = 'starting';
        logger.info(`MediaSession ${this.sessionId} starting stream`);
    }

    /**
     * Pause the stream
     */
    pause(): void {
        if (this.state !== 'streaming') return;
        this.state = 'paused';
        this.emit('pause');
        logger.info(`MediaSession ${this.sessionId} paused`);
    }

    /**
     * Resume the stream
     */
    resume(): void {
        if (this.state !== 'paused') return;
        this.state = 'streaming';
        this.emit('resume');
        logger.info(`MediaSession ${this.sessionId} resumed`);
    }

    /**
     * End the session and cleanup resources
     */
    endSession(): void {
        if (this.state === 'ended') return;

        this.state = 'ended';
        this.clearTimeout();

        // Kill any running process
        if (this.process) {
            this.process.kill('SIGKILL');
            this.process = null;
        }

        // Close streams
        this.inputStream.destroy();
        this.outputStream.destroy();

        this.emit('close');
        logger.info(`MediaSession ${this.sessionId} ended`);
    }

    /**
     * Get the MIME type for the output format
     */
    getOutputMimeType(): string {
        return getMimeType(this.format);
    }

    /**
     * Handle output stream pause
     */
    protected onOutputPause(): void {
        logger.debug(`MediaSession ${this.sessionId} output paused`);
    }

    /**
     * Handle output stream resume
     */
    protected onOutputResume(): void {
        logger.debug(`MediaSession ${this.sessionId} output resumed`);
    }

    /**
     * Start the inactivity timeout
     */
    protected startTimeout(): void {
        this.clearTimeout();
        this.timeoutHandle = setTimeout(() => this.onTimeout(), this.timeoutMs);
    }

    /**
     * Clear the inactivity timeout
     */
    protected clearTimeout(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }
    }

    /**
     * Handle timeout - end session if no destinations connected
     */
    protected onTimeout(): void {
        if (this.destinations.length > 0) {
            // Still have connected clients, don't timeout
            return;
        }

        logger.info(`MediaSession ${this.sessionId} timed out`);
        this.outputStream.destroy();
    }
}
