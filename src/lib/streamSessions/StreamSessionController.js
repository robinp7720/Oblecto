import StreamSession from './StreamSession';
import DirectStreamSession from './StreamSessionTypes/DirectStreamSession';
import DirectHttpStreamSession from './StreamSessionTypes/DirectHttpStreamSession';
import RecodeStreamSession from './StreamSessionTypes/RecodeStreamSession';
import RecodeFederationStreamSession from './StreamSessionTypes/RecodeFederationStreamSession';
import logger from '../../submodules/logger';

export default class StreamSessionController {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};
    }

    /**
     *
     * @param {File} file
     * @param options
     * @returns {StreamSession}
     */
    newSession(file, options) {
        const streamSession = this.createSession(file, options);

        this.sessions[streamSession.sessionId] = streamSession;

        streamSession.on('close', () => {
            logger.log('INFO', streamSession.sessionId, 'output stream has closed');
            delete this.sessions[streamSession.sessionId];
        });

        return streamSession;
    }

    createSession(file, options) {
        if (file.host !== 'local') {
            return new RecodeFederationStreamSession(file, options, this.oblecto);
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

    sessionExists(sessionId) {
        return this.sessions[sessionId] !== undefined;
    }

}
