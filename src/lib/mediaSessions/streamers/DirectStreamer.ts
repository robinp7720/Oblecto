import * as fs from 'fs';
import mimeTypes from 'mime-types';
import logger from '../../../submodules/logger/index.js';
import { MediaSession } from '../MediaSession.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { Streamer, MediaSessionOptions } from '../types.js';

/**
 * Direct streaming session - pipes file directly without transcoding
 * 
 * Used for simple file downloads or when the client supports the native format.
 */
export class DirectStreamSession extends MediaSession {
    public readonly mimeType: string;

    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        this.mimeType = mimeTypes.lookup(file.path as string) || 'application/octet-stream';

        this.httpHeaders = {
            'Accept-Ranges': 'none',
            'Content-Length': this.file.size ?? 0,
            'Content-Type': this.mimeType,
        };
    }

    get seekMode(): 'client' | 'server' {
        return 'client';
    }

    async startStream(): Promise<void> {
        await super.startStream();

        try {
            const readStream = fs.createReadStream(this.file.path as string);

            readStream.pipe(this.outputStream);

            readStream.on('error', (err) => {
                logger.error(`DirectStreamSession ${this.sessionId} read error:`, err);
                this.endSession();
            });
        } catch (e) {
            logger.error(`DirectStreamSession ${this.sessionId} failed to start:`, e);
            throw e;
        }
    }
}

/**
 * Streamer plugin for direct file streaming
 */
export class DirectStreamer implements Streamer {
    readonly type = 'direct';
    readonly priority = 10;

    canHandle(file: File, options: MediaSessionOptions, oblecto: Oblecto): boolean {
        // Only handle local files
        if (file.host !== 'local') return false;

        // Don't handle if HLS explicitly requested
        if (options.streamType === 'hls') return false;

        return true;
    }

    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession {
        return new DirectStreamSession(file, options, oblecto);
    }
}
