import { promises as fs, createReadStream } from 'fs';
import mimeTypes from 'mime-types';
import { MediaSession } from '../MediaSession.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { Request, Response } from 'express';
import type { Streamer, MediaSessionOptions, StreamDestination, HttpDestination } from '../types.js';

/**
 * Direct HTTP streaming session with range request support
 *
 * Handles HTTP byte-range requests for seeking on the client side.
 */
export class DirectHttpStreamSession extends MediaSession {
    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        // Use file's actual format
        this.format = this.file.extension ?? this.format;
        this.videoCodec = this.file.videoCodec ?? this.videoCodec;
        this.audioCodec = this.file.audioCodec ?? this.audioCodec;
    }

    get seekMode(): 'client' | 'server' {
        return 'client';
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async addDestination(destination: StreamDestination): Promise<void> {
        this.clearTimeout();

        if (destination.type !== 'http') {
            throw new Error('DirectHttpStreamSession only supports HTTP destinations');
        }

        const httpDest = destination as HttpDestination;

        // Only support single destination - replace any existing
        if (this.destinations.length > 0) {
            const existing = this.destinations[0].stream as Response;

            existing.destroy();
            this.destinations.length = 0;
        }

        this.destinations.push(httpDest);

        httpDest.stream.on('close', () => {
            const index = this.destinations.indexOf(httpDest);

            if (index > -1) {
                this.destinations.splice(index, 1);
            }
            if (this.destinations.length === 0) {
                this.startTimeout();
            }
        });
    }

    protected onTimeout(): void {
        super.onTimeout();
        this.endSession();
    }

    async startStream(): Promise<void> {
        await super.startStream();

        const httpDest = this.destinations[0] as HttpDestination | undefined;
        if (!httpDest) {
            throw new Error('No HTTP destination connected');
        }

        await DirectHttpStreamSession.handleHttpStream(
            httpDest.request,
            httpDest.stream,
            this.file
        );
    }

    /**
     * Handle HTTP streaming with range support
     * @param req - Express Request object
     * @param res - Express Response object
     * @param file - File object or path string
     */
    static async handleHttpStream(req: Request, res: Response, file: File | string): Promise<void> {
        let path: string;
        let size: number | null | undefined;

        if (typeof file === 'string') {
            path = file;
        } else {
            path = file.path as string;
            size = file.size;
        }

        if (size === null || size === undefined || size === 0) {
            size = (await fs.stat(path)).size;
        }

        const mimeType = mimeTypes.lookup(path) || 'application/octet-stream';

        // Handle range requests for seeking
        if (req.headers.range && req.headers.range.length > 0) {
            const range = req.headers.range;
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] && parts[1].length > 0 ? parseInt(parts[1], 10) : (size || 0) - 1;
            const chunkSize = (end - start) + 1;

            const stream = createReadStream(path, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
            });

            stream.pipe(res);
            return;
        }

        // Full file request
        res.writeHead(200, {
            'Content-Length': size,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
        });

        createReadStream(path).pipe(res);
    }
}

/**
 * Streamer plugin for direct HTTP streaming with range support
 */
export class DirectHttpStreamer implements Streamer {
    readonly type = 'directhttp';
    readonly priority = 5; // Higher priority than direct

    canHandle(file: File, options: MediaSessionOptions, _oblecto: Oblecto): boolean {
        // Only handle local files
        if (file.host !== 'local') return false;

        // Don't handle if HLS or transcode explicitly requested
        if (options.streamType === 'hls') return false;
        if (options.streamType === 'recode' || options.streamType === 'transcode') return false;

        // Check if format is directly playable (container matches target)
        const fileFormat = file.extension?.toLowerCase() || '';
        const targetFormats = options.target.formats.map(f => f.toLowerCase());

        if (fileFormat.length > 0 && targetFormats.includes(fileFormat)) {
            return true;
        }

        return false;
    }

    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession {
        return new DirectHttpStreamSession(file, options, oblecto);
    }
}
