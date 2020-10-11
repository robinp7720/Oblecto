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

        this.outputStream.on('close', () => {
            logger.log('INFO', this.sessionId, 'output stream has closed');
            this.emit('close');
        });
    }

    async addDestination(destination) {
        await super.addDestination(destination);
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
}
