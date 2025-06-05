import StreamSession from '../StreamSession';
import ffmpeg from '../../../submodules/ffmpeg';
import FederationMediaClient from '../../federation/client/FederationMediaClient';
import logger from '../../../submodules/logger';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 * @typedef {import("../../../models/file").File} File
 */

export default class RecodeFederationStreamSession extends StreamSession {
    /**
     * @param {File} file - File to be streamed
     * @param {any} options - Options for Media streamer
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(file, options, oblecto) {
        super(file, options, oblecto);
    }

    async addDestination(destination) {
        await super.addDestination(destination);
    }

    endSession() {
        super.endSession();

        this.federationClient.closeConnection();
    }

    async startStream() {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        await this.initFederationStream();

        let inputOptions = [
            '-re',
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

        this.process = ffmpeg(this.inputStream)
            .format(this.format)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {
                logger.log('INFO', this.sessionId, cmd);
            });

        this.process.on('error', (err) => {
            if (err.message !== 'ffmpeg was killed with signal SIGKILL') logger.log('ERROR', this.sessionId, err);
        });

        this.process.pipe(this.outputStream, { end: true });
    }

    async initFederationStream() {
        this.federationClient = new FederationMediaClient(this.oblecto, this.file.host);

        await this.federationClient.connect();

        await this.federationClient.setStreamDestination(this.inputStream);
        await this.federationClient.setStreamOffset(this.offset);
        await this.federationClient.startStreamFile(this.file.path);
    }
}
