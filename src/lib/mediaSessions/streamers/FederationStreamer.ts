import ffmpeg from '../../../submodules/ffmpeg.js';
import logger from '../../../submodules/logger/index.js';
import { MediaSession } from '../MediaSession.js';
import { FfmpegConfig } from '../utils/FfmpegConfig.js';
import FederationMediaClient from '../../federation/client/FederationMediaClient.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { Streamer, MediaSessionOptions, StreamDestination } from '../types.js';

/**
 * Federation streaming session
 * 
 * Streams from a federated Oblecto server and transcodes locally.
 */
export class FederationStreamSession extends MediaSession {
    protected federationClient?: FederationMediaClient;
    protected started: boolean = false;

    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super(file, options, oblecto);
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        await super.addDestination(destination);
    }

    endSession(): void {
        super.endSession();

        // Close federation connection
        void this.federationClient?.closeConnection();
    }

    async startStream(): Promise<void> {
        await super.startStream();

        if (this.started) return;
        this.started = true;

        // Initialize federation connection
        await this.initFederationStream();

        const inputOptions = FfmpegConfig.getHardwareAccelInputOptions(this.oblecto.config);
        const outputOptions = [
            '-movflags empty_moov',
            '-copyts',
        ];

        // Handle pixel format for NVIDIA
        if (this.oblecto.config.transcoding?.hardwareAcceleration) {
            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                outputOptions.push('-pix_fmt yuv420p');
            }
        }

        const videoCodec = FfmpegConfig.getVideoCodec(this.videoCodec, this.oblecto.config);

        this.process = ffmpeg(this.inputStream)
            .format(this.format)
            .videoCodec(videoCodec)
            .audioCodec(this.audioCodec ?? 'aac')
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {
                logger.info(`FederationSession ${this.sessionId} started: ${cmd}`);
            })
            .on('error', (err: Error) => {
                if (err.message !== 'ffmpeg was killed with signal SIGKILL') {
                    logger.error(`FederationSession ${this.sessionId} error:`, err);
                }
            });

        this.process.pipe(this.outputStream, { end: true });
    }

    /**
     * Initialize the federation media stream
     */
    protected async initFederationStream(): Promise<void> {
        this.federationClient = new FederationMediaClient(
            this.oblecto,
            this.file.host as string
        );

        await this.federationClient.connect();
        await this.federationClient.setStreamDestination(this.inputStream);
        await this.federationClient.setStreamOffset(this.offset);
        await this.federationClient.startStreamFile(this.file.path as string);
    }
}

/**
 * Streamer plugin for federation streaming
 */
export class FederationStreamer implements Streamer {
    readonly type = 'federation';
    readonly priority = 1; // Highest priority for remote files

    canHandle(file: File, options: MediaSessionOptions, oblecto: Oblecto): boolean {
        // Only handle remote (federated) files
        return file.host !== 'local';
    }

    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession {
        return new FederationStreamSession(file, options, oblecto);
    }
}
