import DirectStreamSession from './StreamSessionTypes/DirectStreamSession.js';
import DirectHttpStreamSession from './StreamSessionTypes/DirectHttpStreamSession.js';
import RecodeStreamSession from './StreamSessionTypes/RecodeStreamSession.js';
import RecodeFederationStreamSession from './StreamSessionTypes/RecodeFederationStreamSession.js';
import logger from '../../submodules/logger/index.js';
import HLSStreamer from './StreamSessionTypes/HLSStreamer.js';

import StreamSession, { StreamOptions } from './StreamSession.js';

import { File } from '../../models/file.js';

import type Oblecto from '../oblecto/index.js';

type StreamSessionMap = Record<string, StreamSession>;

export default class StreamSessionController {
    public oblecto: Oblecto;
    public sessions: StreamSessionMap;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};
    }

    /**
     * Initiate a new streaming session with a specified file
     * @param file - File for which to initiate a new streamer session for
     * @param options - options for created streamer session
     * @returns - Created streamer session
     */
    newSession(file: File, options: StreamOptions): StreamSession {
        const streamSession = this.createSession(file, options);

        this.sessions[streamSession.sessionId] = streamSession;

        streamSession.on('close', () => {
            logger.info( streamSession.sessionId, 'has ended');
            delete this.sessions[streamSession.sessionId];
        });

        return streamSession;
    }

    /**
     * Create a new streamer session based on the given options
     * @param file - File for which to create a stream session
     * @param options - Streamer object
     * @returns - New stream session
     */
    createSession(file: File, options: StreamOptions): StreamSession {
        if (file.host !== 'local') {
            return new RecodeFederationStreamSession(file, options, this.oblecto);
        }

        if (options.streamType === 'hls') {
            return new HLSStreamer(file, options, this.oblecto);
        }

        if (this.oblecto.config.transcoding.transcodeEverything) {
            return new RecodeStreamSession(file, options, this.oblecto);
        }

        if (options.streamType === 'direct') {
            return new DirectStreamSession(file, options, this.oblecto);
        }

        if (options.streamType === 'directhttp') {
            return new DirectHttpStreamSession(file, options, this.oblecto);
        }

        if (options.streamType === 'recode') {
            return new RecodeStreamSession(file, options, this.oblecto);
        }

        return new RecodeStreamSession(file, options, this.oblecto);
    }

    /**
     * Returns whether a specified streamer session exists
     * @param sessionId - Stream id to check
     * @returns - Whether or not the stream session exists
     */
    sessionExists(sessionId: string): boolean {
        return this.sessions[sessionId] !== undefined;
    }
}
