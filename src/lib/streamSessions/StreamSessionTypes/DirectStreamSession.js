import StreamSession from '../StreamSession';

export default class DirectStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);
    }

    async addDestination(destination) {

    }

    async startStream() {
        await super.startStream();

    }
}
