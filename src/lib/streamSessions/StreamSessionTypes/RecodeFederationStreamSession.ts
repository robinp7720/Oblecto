import StreamSession, { StreamOptions, StreamDestination } from '../StreamSession.js';
import ffmpeg from '../../../submodules/ffmpeg.js';
import FederationMediaClient from '../../federation/client/FederationMediaClient.js';
import logger from '../../../submodules/logger/index.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';

export default class RecodeFederationStreamSession extends StreamSession {
    public federationClient?: FederationMediaClient;
    public started?: boolean;

    /**
     * @param file - File to be streamed
     * @param options - Options for Media streamer
     * @param oblecto - Oblecto server instance
     */
    constructor(file: File, options: StreamOptions, oblecto: Oblecto) {
        super(file, options, oblecto);
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        await super.addDestination(destination);
    }

    endSession(): void {
        super.endSession();

        this.federationClient?.closeConnection();
    }

    async startStream(): Promise<void> {
        await super.startStream();

        if (this.started) return;

        this.started = true;

        await this.initFederationStream();

        const inputOptions = ['-noaccurate_seek'];

        const outputOptions = [
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
            .audioCodec(this.audioCodec ?? 'aac')
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {
                logger.info( this.sessionId, cmd);
            });

        this.process.on('error', (err) => {
            if (err.message !== 'ffmpeg was killed with signal SIGKILL') logger.error( this.sessionId, err);
        });

        this.process.pipe(this.outputStream, { end: true });
    }

    async initFederationStream(): Promise<void> {
        this.federationClient = new FederationMediaClient(this.oblecto, this.file.host as string);

        await this.federationClient.connect();

        await this.federationClient.setStreamDestination(this.inputStream);
        await this.federationClient.setStreamOffset(this.offset);
        await this.federationClient.startStreamFile(this.file.path as string);
    }
}
