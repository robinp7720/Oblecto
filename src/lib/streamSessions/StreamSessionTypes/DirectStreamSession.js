import mimeTypes from 'mime-types';
import StreamSession from '../StreamSession';
import * as fs from 'fs';
import logger from '../../../submodules/logger';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 * @typedef {import("../../../models/file").File} File
 */

export default class DirectStreamSession extends StreamSession {
    /**
     * @param {File} file - File to be streamed
     * @param {any} options - Options for Media streamer
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        this.mimeType = mimeTypes.lookup(file.path);

        this.httpHeaders = {
            'Accept-Ranges': 'none',
            'Content-Length': this.file.size,
            'Content-Type': this.mimeType
        };
    }

    async startStream() {
        await super.startStream();

        try {
            fs.createReadStream(this.file.path).pipe(this.outputStream);
        } catch (e) {
            logger.error(e);
        }
    }
}
