import ffmpeg from '../../../submodules/ffmpeg.js';
import logger from '../../../submodules/logger/index.js';
import { MediaSession } from '../MediaSession.js';
import { FfmpegConfig } from '../utils/FfmpegConfig.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';
import type { Stream } from '../../../models/stream.js';
import type { Streamer, MediaSessionOptions } from '../types.js';

/**
 * Transcoding session using FFmpeg
 * 
 * Handles format conversion and codec transcoding for devices
 * that don't support the source format.
 */
export class TranscodeStreamSession extends MediaSession {
    public targetLanguageCode: string;
    protected started: boolean = false;

    constructor(file: File, options: MediaSessionOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        this.targetLanguageCode = oblecto.config.streaming?.defaultTargetLanguageCode || 'eng';

        // Copy streams if codecs already match target
        if (this.targetVideoCodecs.includes(this.file.videoCodec ?? '')) {
            this.videoCodec = 'copy';
        }

        if (this.targetAudioCodecs.includes(this.file.audioCodec ?? '')) {
            this.audioCodec = 'copy';
        }
    }

    async startStream(): Promise<void> {
        await super.startStream();

        if (this.started) return;
        this.started = true;

        const inputOptions = FfmpegConfig.getHardwareAccelInputOptions(this.oblecto.config);
        const outputOptions = FfmpegConfig.getTranscodeOutputOptions(this.oblecto.config);

        // Select audio/video streams
        const streamMapping = await this.selectStreams();

        if (streamMapping.length > 0) {
            outputOptions.push(...streamMapping);
        }

        const videoCodec = this.videoCodec === 'copy'
            ? 'copy'
            : FfmpegConfig.getVideoCodec(this.videoCodec, this.oblecto.config);

        this.process = ffmpeg(this.file.path as string)
            .format(this.format)
            .videoCodec(videoCodec)
            .audioCodec(this.audioCodec ?? 'aac')
            .seekInput(this.offset)
            .inputOptions(inputOptions)
            .outputOptions(outputOptions)
            .on('start', (cmd) => {
                logger.info(`TranscodeSession ${this.sessionId} started: ${cmd}`);
            })
            .on('error', (err) => {
                logger.error(`TranscodeSession ${this.sessionId} error:`, err);
            });

        // Pipe to first destination
        if (this.destinations.length > 0) {
            this.process.pipe(this.destinations[0].stream, { end: true });
        } else {
            this.process.pipe(this.outputStream, { end: true });
        }
    }

    /**
     * Select the best audio and video streams
     */
    protected async selectStreams(): Promise<string[]> {
        try {
            // getStreams is a Sequelize association mixin
            const streams = await (this.file as any).getStreams() as Stream[];

            if (!streams || streams.length === 0) {
                return [];
            }

            const audioStreams: Stream[] = [];
            const videoStreams: Stream[] = [];

            for (const stream of streams) {
                if (stream.codec_type === 'video') videoStreams.push(stream);
                if (stream.codec_type === 'audio') audioStreams.push(stream);
            }

            // Default to first streams
            let selectedAudioIndex = audioStreams[0]?.index ?? undefined;
            const selectedVideoIndex = videoStreams[0]?.index ?? undefined;

            // Try to find matching language for audio
            for (const stream of audioStreams) {
                if (stream.tags_language === this.targetLanguageCode && stream.index !== null) {
                    selectedAudioIndex = stream.index;
                    break;
                }
            }

            if (selectedVideoIndex !== undefined && selectedAudioIndex !== undefined) {
                return FfmpegConfig.getStreamMappingOptions(selectedAudioIndex, selectedVideoIndex);
            }
        } catch (error) {
            logger.warn(`TranscodeSession ${this.sessionId} failed to select streams:`, error);
        }

        return [];
    }

    protected onOutputPause(): void {
        super.onOutputPause();
        if (this.process) {
            this.process.kill('SIGSTOP');
        }
    }

    protected onOutputResume(): void {
        super.onOutputResume();
        if (this.process) {
            this.process.kill('SIGCONT');
        }
    }
}

/**
 * Streamer plugin for FFmpeg transcoding
 */
export class TranscodeStreamer implements Streamer {
    readonly type = 'transcode';
    readonly priority = 100; // Low priority - fallback

    canHandle(file: File, options: MediaSessionOptions, oblecto: Oblecto): boolean {
        // Only handle local files
        if (file.host !== 'local') return false;

        // Don't handle HLS
        if (options.streamType === 'hls') return false;

        // Check if transcoding is forced
        if (oblecto.config.transcoding?.transcodeEverything) return true;

        // Check if format/codec conversion is needed
        const fileFormat = file.extension?.toLowerCase();
        const targetFormats = options.target.formats.map(f => f.toLowerCase());

        // Needs transcode if format doesn't match
        if (fileFormat && !targetFormats.includes(fileFormat)) return true;

        // Needs transcode if video codec doesn't match
        if (file.videoCodec && !options.target.videoCodecs.includes(file.videoCodec)) return true;

        // Needs transcode if audio codec doesn't match
        if (file.audioCodec && !options.target.audioCodecs.includes(file.audioCodec)) return true;

        return false;
    }

    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession {
        return new TranscodeStreamSession(file, options, oblecto);
    }
}

// Also export as 'recode' alias for backward compatibility
export { TranscodeStreamer as RecodeStreamer };
