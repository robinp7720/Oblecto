import DirectStreamSession from './StreamSessionTypes/DirectStreamSession';
import DirectHttpStreamSession from './StreamSessionTypes/DirectHttpStreamSession';
import RecodeStreamSession from './StreamSessionTypes/RecodeStreamSession';
import RecodeFederationStreamSession from './StreamSessionTypes/RecodeFederationStreamSession';
import logger from '../../submodules/logger';
import HLSStreamer from './StreamSessionTypes/HLSStreamer';

import StreamSession from './StreamSession';

import { File } from '../../models/file';

export default class StreamSessionController {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};
    }

    /**
     * Initiate a new streaming session with a specified file
     *
     * @param {File} file - File for which to initiate a new streamer session for
     * @param {*} options - options for created streamer session
     * @returns {StreamSession} - Created streamer session
     */
    newSession(file, options) {
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
     *
     * @param {File} file - File for which to create a stream session
     * @param {*} options - Streamer object
     * @returns {HLSStreamer|DirectHttpStreamSession|RecodeFederationStreamSession|DirectStreamSession|RecodeStreamSession} - New stream session
     */
    createSession(file, options) {
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
    }

    /**
     * Returns whether a specified streamer session exists
     *
     * @param {string} sessionId - Stream id to check
     * @returns {boolean} - Whether or not the stream session exists
     */
    sessionExists(sessionId) {
        return this.sessions[sessionId] !== undefined;
    }

}
