import events from 'events';
import {v4} from 'uuid';
import logger from '../../submodules/logger';
import Stream from 'stream';

export default class StreamSession extends events.EventEmitter{
    /**
     *
     * @param {File} file
     * @param options
     * @param {Oblecto} oblecto
     */
    constructor(file, options, oblecto) {
        super();

        logger.log('INFO', 'New StreamSession initiating');

        this.oblecto = oblecto;

        this.file = file;
        this.sessionId = v4();
        this.destinations = [];

        this.format = options.format || 'mp4';
        this.videoCodec = options.videoCodec || 'h264';
        this.audioCodec = options.audioCodec || 'aac';

        this.offset = options.offset || 0;

        this.inputStream = new Stream.PassThrough;
        this.outputStream = new Stream.PassThrough;

        this.outputStream.on('close', () => {
            logger.log('INFO', this.sessionId, 'output stream has closed');
            this.emit('close');
        });

        this.startTimeout();
    }

    startTimeout() {
        this.timeout = setTimeout(() => {
            logger.log('INFO', 'StreamSession', this.sessionId, 'has timed out');
            this.emit('close');
        }, 10000);
    }

    async addDestination(destination) {
        this.destinations.push(destination);
        this.outputStream.pipe(destination.stream);

        if (destination.type === 'http') {
            destination.stream.writeHead(200, {
                'Content-Type': this.getOutputMimetype()
            });
        }

        let _this = this;

        destination.stream
            .on('error', (err) => {
                logger.log('ERROR', this.sessionId, err);
            })
            .on('close', function () {
                for (let i in _this.destinations) {
                    if (_this.destinations[i].stream === this) {
                        _this.destinations.splice(i, 1);
                    }
                }

                if (_this.destinations.length === 0) {
                    logger.log('INFO', _this.sessionId, 'last client has disconnected. Setting timeout output stream');
                    _this.startTimeout();
                }
            });
    }

    async startStream() {
        clearTimeout(this.timeout);
    }

    getOutputMimetype() {
        if (this.format === 'mp4')
            return 'video/mp4';

        if (this.format === 'mpegts')
            return 'video/mp2t';
    }

    getFfmpegVideoCodec() {
        let codec = this.videoCodec;

        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                if (codec === 'h264'){
                    return 'h264_nvenc';
                }
            }

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'vaapi') {
                if (codec === 'h264'){
                    return 'h264_vaapi';
                }
            }
        }

        let codecs = {
            'h264': 'libx264'
        };

        if (codecs[codec]) codec = codecs[codec];

        return codec;
    }
}
