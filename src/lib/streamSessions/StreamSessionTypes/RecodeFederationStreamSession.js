import StreamSession from '../StreamSession';
import ffmpeg from '../../../submodules/ffmpeg';
import Stream from 'stream';
import FederationMediaClient from '../../federation/client/FederationMediaClient';
import logger from '../../../submodules/logger';

export default class RecodeFederationStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);
    }

    async addDestination(destination) {
        await super.addDestination(destination);
    }

    async startStream() {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        await this.initFederationStream();

        let inputOptions = [
            '-noaccurate_seek',
        ];

        let outputOptions = [
            '-movflags', 'empty_moov',
            '-copyts',
        ];

        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            inputOptions.push('-hwaccel ' + this.oblecto.config.transcoding.hardwareAccelerator);
        }

        this.process = ffmpeg(this.inputStream)
            //.native()
            .format(this.format)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {

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

    async initFederationStream() {
        this.federationClient = new FederationMediaClient(this.oblecto, this.file.host);

        await this.federationClient.connect();

        await this.federationClient.setStreamDestination(this.inputStream);
        await this.federationClient.setStreamOffset(this.offset);
        await this.federationClient.startStreamFile(this.file.path);
    }
}
