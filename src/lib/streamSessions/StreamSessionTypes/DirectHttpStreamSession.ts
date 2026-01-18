import StreamSession, { StreamOptions, StreamDestination } from '../StreamSession.js';
import { File } from '../../../models/file.js';
import mimeTypes from 'mime-types';
import { promises as fs, createReadStream } from 'fs';
import logger from '../../../submodules/logger/index.js';

import type { Response, Request } from 'express';
import type Oblecto from '../../oblecto/index.js';

type HttpDestination = StreamDestination & {
    type: 'http';
    stream: Response;
    request: Request;
};

export default class DirectHttpStreamSession extends StreamSession {
    /**
     * @param file - File to stream
     * @param options - Streamer options
     * @param oblecto - Oblecto server instance
     */
    constructor(file: File, options: StreamOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        this.format = this.file.extension ?? this.format;
        this.videoCodec = this.file.videoCodec ?? this.videoCodec;
        this.audioCodec = this.file.audioCodec ?? this.audioCodec;
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        if (this.timeout) {
            this.clearTimeout();
        }

        // Logically we only support http destinations
        // Therefore, throw an error if the type is not http
        if (destination.type !== 'http') {
            logger.error( 'DirectHttpStreamer only supports http stream types');
            throw new Error('HTTP Streamer only supports HTTP stream types');
        }

        const httpDestination = destination as HttpDestination;

        // This streamer only supports a single stream destination,
        // so if another destination was found, destroy the output stream and remove it
        if (this.destinations[0]) {
            (this.destinations[0].stream as Response).destroy();
            delete this.destinations[0];
        }

        this.destinations[0] = httpDestination;

        httpDestination.stream.on('close', () => {
            if (this.destinations.length === 0) {
                this.startTimeout();
            }
        });
    }

    onTimeOut(): void {
        super.onTimeOut();
        this.endSession();
    }

    async startStream(): Promise<void> {
        await super.startStream();

        const httpDestination = this.destinations[0] as HttpDestination;

        const req = httpDestination.request;
        const res = httpDestination.stream;

        await DirectHttpStreamSession.httpStreamHandler(req, res, this.file);
    }

    /**
     * @param req - HTTP server request object
     * @param res - HTTP server response object
     * @param file - File path or object to stream
     */
    static async httpStreamHandler(req: Request, res: Response, file: File | string): Promise<void> {
        let path = file;
        let size: number | null | undefined;

        if (file instanceof File) {
            path = file.path as string;
            size = file.size;
        }

        if (!size) {
            size = (await fs.stat(path as string)).size;
        }

        const mimeType = mimeTypes.lookup(path as string);

        if (req.headers.range) {
            // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            const range = req.headers.range;
            const parts = range.replace(/bytes=/, '').split('-');
            const partialStart = parts[0];
            const partialEnd = parts[1];

            const start = parseInt(partialStart, 10);
            const end = partialEnd ? parseInt(partialEnd, 10) : size  - 1;
            const chunkSize = (end - start) + 1;

            const stream = createReadStream(path as string, {
                start: start,
                end: end
            });

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType || 'application/octet-stream'
            });

            stream.pipe(res);

            return;
        }

        res.writeHead(200, {
            'Content-Length': size,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType || 'application/octet-stream'
        });

        createReadStream(path as string).pipe(res);
    }
}
