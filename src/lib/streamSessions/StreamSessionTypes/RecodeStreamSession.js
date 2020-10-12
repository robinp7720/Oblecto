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
    }

    async addDestination(destination) {
        await super.addDestination(destination);
    }

    async startStream() {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        let inputOptions = [
            '-noaccurate_seek',
        ];

        let outputOptions = [
            '-movflags', 'empty_moov',
            '-copyts',
        ];

        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            inputOptions.push('-hwaccel ' + this.oblecto.config.transcoding.hardwareAccelerator);

            // The Nvidia NVENC encoder doesn't support 10 bit encoding, so we need to force 8 bit
            // if the cuda accelerator has been selected

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                outputOptions.push('-pix_fmt yuv420p');
            }
        }

        this.process = ffmpeg(this.file.path)
            .format(this.format)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
            .seekInput(this.offset)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {
                logger.log('INFO', this.sessionId, cmd);
            })
            .on('end', () => {
                this.endSession();
            });

        this.process.on('error', (err) => {
            if (err.message !== 'ffmpeg was killed with signal SIGKILL') logger.log('ERROR', this.sessionId, err);

            this.endSession();
        });

        this.process.pipe(this.outputStream, {end: true});
    }
}
