import StreamSession from '../StreamSession';
import ffmpeg from '../../../submodules/ffmpeg';
import Stream from 'stream';
import logger from '../../../submodules/logger';

export default class RecodeStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        if (this.videoCodec === this.file.videoCodec) {
            this.videoCodec = 'copy';
        }

        if (this.audioCodec === this.file.audioCodec) {
            this.audioCodec = 'copy';
        }

        this.inputStream = new Stream.PassThrough;
        this.outputStream = new Stream.PassThrough;

        this.outputStream.on('close', () => {
            logger.log('INFO', this.sessionId, 'output stream has closed');
            this.emit('close');
        });
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
        await super.startStream();

        if (this.started) return;

        this.started = true;

        this.process = ffmpeg(this.file.path)
            .format(this.format)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
            .seekInput(this.offset)
            .inputOptions([
                '-noaccurate_seek',
            ])
            .outputOptions([
                '-movflags empty_moov',
                '-copyts',
            ])
            .on('start', (cmd) => {
                logger.log('INFO', this.sessionId, cmd);
            })
            .on('end', () => {
                this.process.kill();
            });

        this.process.on('error', (err) => {
            logger.log('ERROR', this.sessionId, err);

            this.process.kill();
        });

        this.process.pipe(this.outputStream, {end: true});
    }


    getFfmpegVideoCodec() {
        let codec = this.videoCodec;

        let codecs = {
            'h264': 'libx264'
        };

        if (codecs[codec]) codec = codecs[codec];

        return codec;
    }
}
