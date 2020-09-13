import events from 'events';
import {v4} from 'uuid';

export default class StreamSession extends events.EventEmitter{
    /**
     *
     * @param {File} file
     * @param options
     * @param {Oblecto} oblecto
     */
    constructor(file, options, oblecto) {
        super();

        this.oblecto = oblecto;

        this.file = file;
        this.sessionId = v4();
        this.destinations = [];

        this.format = options.format || 'mp4';
        this.videoCodec = options.videoCodec || 'copy';
        this.audioCodec = options.audioCodec || 'aac';

        this.offset = options.offset || 0;

        this.startTimeout();
    }

    startTimeout() {
        this.timeout = setTimeout(() => {
            this.emit('close');
        }, 10000);
    }

    async addDestination(destination) {

    }

    async startStream() {
        clearTimeout(this.timeout);
    }
}
