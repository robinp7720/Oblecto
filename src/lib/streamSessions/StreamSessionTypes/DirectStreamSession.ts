import mimeTypes from 'mime-types';
import StreamSession, { StreamOptions } from '../StreamSession.js';
import * as fs from 'fs';
import logger from '../../../submodules/logger/index.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';

export default class DirectStreamSession extends StreamSession {
    public mimeType: string | false;

    /**
     * @param file - File to be streamed
     * @param options - Options for Media streamer
     * @param oblecto - Oblecto server instance
     */
    constructor(file: File, options: StreamOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        this.mimeType = mimeTypes.lookup(file.path as string);

        this.httpHeaders = {
            'Accept-Ranges': 'none',
            'Content-Length': this.file.size ?? 0,
            'Content-Type': this.mimeType || 'application/octet-stream'
        };
    }

    async startStream(): Promise<void> {
        await super.startStream();

        try {
            fs.createReadStream(this.file.path as string).pipe(this.outputStream);
        } catch (e) {
            logger.error(e);
        }
    }
}
