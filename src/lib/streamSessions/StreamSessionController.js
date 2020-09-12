import StreamSession from './StreamSession';
import DirectStreamSession from './StreamSessionTypes/DirectStreamSession';
import DirectHttpStreamSession from './StreamSessionTypes/DirectHttpStreamSession';
import RecodeStreamSession from './StreamSessionTypes/RecodeStreamSession';
import RecodeFederationStreamSession from './StreamSessionTypes/RecodeFederationStreamSession';

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

        console.log('Session started:', streamSession.sessionId);

        streamSession.on('close', () => {
            delete this.sessions[streamSession.sessionId];

            console.log('Active Sessions:', Object.keys(this.sessions).length);
        });

        return streamSession;
    }

    createSession(file, options) {
        if (file.host !== 'local') {
            return new RecodeFederationStreamSession(file, options, this.oblecto);
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
