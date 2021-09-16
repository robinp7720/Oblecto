import StreamSession from '../StreamSession';
import mimeTypes from 'mime-types';
import { promises as fs, createReadStream } from 'fs';
import logger from '../../../submodules/logger';

import { File } from '../../../models/file';

import Oblecto from '../../oblecto';

import Response from 'restify/lib/response';
import Request from 'restify/lib/request';

export default class DirectHttpStreamSession extends StreamSession {
    /**
     * @param { File } file - File to stream
     * @param { * } options - Streamer options
     * @param { Oblecto } oblecto - Oblecto server instance
     */
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        this.format = this.file.extension;
        this.videoCodec = this.file.videoCodec;
        this.audioCodec = this.file.audioCodec;
    }

    async addDestination(destination) {
        // Logically we only support http destinations
        // Therefore, throw an error if the type is not http
        if (destination.type !== 'http') {
            logger.log('ERROR', 'DirectHttpStreamer only supports http stream types');
            throw new Error('HTTP Streamer only supports HTTP stream types');
        }

        // This streamer only supports a single stream destination,
        // so if another destination was found, destroy the output stream and remove it
        if (this.destinations[0]) {
            this.destinations[0].stream.destroy();
        }

        this.destinations[0] = destination;

        destination.stream.on('close', () => {
            this.startTimeout();
        });
    }

    async startStream() {
        await super.startStream();

        let req = this.destinations[0].request;
        let res = this.destinations[0].stream;

        await DirectHttpStreamSession.httpStreamHandler(req, res, this.file);
    }

    /**
     * @param { Request } req - HTTP server request object
     * @param { Response } res - HTTP server response object
     * @param { File|string } file - File path or object to stream
     */
    static async httpStreamHandler(req, res, file) {
        let path = file;
        let size;

        if (file instanceof File) {
            path = file.path;
            size = file.size;
        }

        if (!size) {
            size = (await fs.stat(path)).size;
        }

        const mimeType = mimeTypes.lookup(path);

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

            let stream = createReadStream(path, {
                start: start,
                end: end
            });

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType
            });

            stream.pipe(res);

            return;
        }

        res.writeHead(200, {
            'Content-Length': size,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType
        });

        createReadStream(path).pipe(res);
    }

}
