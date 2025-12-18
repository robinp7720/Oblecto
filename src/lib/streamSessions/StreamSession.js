import { EventEmitter } from 'events';
import { v4 } from 'uuid';
import logger from '../../submodules/logger';
import * as Stream from 'stream';

/**
 * @typedef {import('../oblecto').default} Oblecto
 * @typedef {import("../../models/file").File} File
 */

export default class StreamSession extends EventEmitter {
    /**
     *
     * @param {File} file - File to stream
     * @param {*} options - Streamer options
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(file, options, oblecto) {
        super();

        logger.info( 'New StreamSession initiating');

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

        this.process = null;
        this.offset = options.offset || 0;
        this.paused = true;

        this.inputStream = new Stream.PassThrough();
        this.outputStream = new Stream.PassThrough();

        this.outputStream.on('pause', () => this.outputPause());
        this.outputStream.on('resume', () => this.outputResume());

        this.outputStream.on('close', () => {
            logger.info( this.sessionId, 'output stream has closed');
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

    outputPause() {
        this.paused = true;
        logger.info( 'Pausing stream session');
    }
    outputResume() {
        this.paused = false;
        logger.info( 'Resuming stream session');
    }

    endSession() {
        if (this.process) {
            this.process.kill();
        }

        this.emit('close');
    }

    startTimeout() {
        if (this.timeout) this.clearTimeout();

        this.timeout = setTimeout(() => this.onTimeOut(), this.timeoutTime);
    }

    onTimeOut() {
        // Some video clients start a new connection before closing the old one.
        // we don't want to kill the session if a client is still connected
        for (const session of this.destinations) {
            if (session) return;
        }

        logger.info( 'StreamSession', this.sessionId, 'has timed out. Destroying output stream');
        this.outputStream.destroy();
    }

    async addDestination(destination) {
        this.destinations.push(destination);
        this.outputStream.pipe(destination.stream);

        if (destination.type === 'http') {
            destination.stream.setHeader('Content-Type', this.getOutputMimetype());
            destination.stream.setHeader('Transfer-Encoding', 'chunked');
            destination.stream.status(this.httpStatusCode);
        }

        destination.stream
            .on('error', (err) => {
                logger.error( this.sessionId, err);
            })
            .on('close', () => {
                // Remove destination by reference rather than finding index
                const destinationIndex = this.destinations.indexOf(destination);
                if (destinationIndex > -1) {
                    this.destinations.splice(destinationIndex, 1);
                }

                if (!this.destinations.length) {
                    logger.info( this.sessionId, 'last client has disconnected. Setting timeout output stream');
                    this.startTimeout();
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
            return 'video/x-matroska';

        return 'video';
    }

    getFfmpegVideoCodec() {
        if (this.oblecto.config.transcoding.hardwareAcceleration) {
            if (this.oblecto.config.transcoding.hardwareAccelerator === 'cuda') {
                if (this.videoCodec === 'h264'){
                    return 'h264_nvenc';
                }
            }

            if (this.oblecto.config.transcoding.hardwareAccelerator === 'vaapi') {
                if (this.videoCodec === 'h264'){
                    return 'h264_vaapi';
                }
            }
        }

        let codecs = { 'h264': 'libx264' };

        if (codecs[this.videoCodec]) return codecs[this.videoCodec];

        return this.videoCodec;
    }
}
