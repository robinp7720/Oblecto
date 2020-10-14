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

        this.targetFormats = options.target.formats;
        this.targetVideoCodecs = options.target.videoCodecs;
        this.targetAudioCodecs = options.target.audioCodecs;

        this.format = this.targetFormats[0] || 'mp4';
        this.videoCodec = this.targetVideoCodecs[0] || 'h264';
        this.audioCodec = this.targetAudioCodecs[0] || 'aac';

        this.offset = options.offset || 0;

        this.inputStream = new Stream.PassThrough;
        this.outputStream = new Stream.PassThrough;

        this.outputStream.on('pause', () => this.outputPause());
        this.outputStream.on('resume', () => this.outputResume());

        this.outputStream.on('close', () => {
            logger.log('INFO', this.sessionId, 'output stream has closed');
            this.endSession();
        });


        this.httpHeaders = {
            'Content-Type': this.getOutputMimetype(),
            'Accept-Ranges': 'none',
        };

        this.httpStatusCode = 200;
        this.timeoutTime = 10000;

        this.startTimeout();
    }

    outputPause() {}
    outputResume() {}

    endSession() {
        if (this.process) {
            this.process.kill();
        }

        this.emit('close');
    }

    startTimeout() {
        if (this.timeout) this.clearTimeout();

        this.timeout = setTimeout(() => {
            logger.log('INFO', 'StreamSession', this.sessionId, 'has timed out. Destroying output stream');
            this.outputStream.destroy();
        }, this.timeoutTime);
    }

    async addDestination(destination) {
        this.destinations.push(destination);
        this.outputStream.pipe(destination.stream);

        if (destination.type === 'http') {
            destination.stream.writeHead(this.httpStatusCode, this.httpHeaders);
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

    clearTimeout() {
        clearTimeout(this.timeout);
    }

    async startStream() {
        this.clearTimeout();
    }

    getOutputMimetype() {
        if (this.format === 'mp4')
            return 'video/mp4';

        if (this.format === 'mpegts')
            return 'video/mp2t';

        if (this.format === 'matroska')
            return 'video/video/x-matroska';

        return 'video';
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
