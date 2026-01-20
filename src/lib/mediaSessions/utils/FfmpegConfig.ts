import type { IConfig } from '../../../interfaces/config.js';

/**
 * Hardware acceleration configuration
 */
export interface HardwareAccelConfig {
    enabled: boolean;
    accelerator: string;
}

/**
 * FFmpeg configuration builder utility
 * 
 * Centralizes FFmpeg command configuration to avoid duplication
 * across different streamer implementations.
 */
export class FfmpegConfig {
    /**
     * Get input options for hardware acceleration
     * @param config - The application configuration
     */
    static getHardwareAccelInputOptions(config: IConfig): string[] {
        const options: string[] = ['-noaccurate_seek'];

        if (config.transcoding?.hardwareAcceleration) {
            const accelerator = config.transcoding.hardwareAccelerator || 'cuda';

            options.push(`-hwaccel ${accelerator}`);

            if (accelerator === 'vaapi') {
                options.push('-hwaccel_output_format vaapi');
            }
        }

        return options;
    }

    /**
     * Get the FFmpeg video codec string for the given target codec
     * @param targetCodec - The target codec to resolve
     * @param config - The application configuration
     */
    static getVideoCodec(targetCodec: string | null, config: IConfig): string {
        if (!targetCodec || targetCodec.length === 0 || targetCodec === 'copy') {
            return 'copy';
        }

        if (config.transcoding?.hardwareAcceleration) {
            const accelerator = config.transcoding.hardwareAccelerator || 'cuda';

            if (targetCodec === 'h264') {
                if (accelerator === 'cuda') return 'h264_nvenc';
                if (accelerator === 'vaapi') return 'h264_vaapi';
            }

            if (targetCodec === 'hevc' || targetCodec === 'h265') {
                if (accelerator === 'cuda') return 'hevc_nvenc';
                if (accelerator === 'vaapi') return 'hevc_vaapi';
            }
        }

        // Software codec mappings
        const softwareCodecs: Record<string, string> = {
            'h264': 'libx264',
            'hevc': 'libx265',
            'h265': 'libx265',
            'vp8': 'libvpx',
            'vp9': 'libvpx-vp9',
            'av1': 'libaom-av1',
        };

        return softwareCodecs[targetCodec] || targetCodec;
    }

    /**
     * Get output options for fragmented MP4 streaming
     */
    static getFragmentedMp4Options(): string[] {
        return [
            '-movflags +frag_keyframe+empty_moov+default_base_moof',
            '-reset_timestamps 1',
            '-copyts',
            '-preset ultrafast',
            '-tune zerolatency',
        ];
    }

    /**
     * Get output options for basic transcoding
     * @param config - The application configuration
     */
    static getTranscodeOutputOptions(config: IConfig): string[] {
        const options = this.getFragmentedMp4Options();

        // Handle pixel format for NVIDIA encoder (doesn't support 10-bit)
        if (config.transcoding?.hardwareAcceleration) {
            if (config.transcoding.hardwareAccelerator === 'cuda') {
                options.push('-pix_fmt yuv420p');
            }
        }

        return options;
    }

    /**
     * Get output options for HLS streaming
     * @param segmentDir - Directory to store segments
     * @param segmentTemplate - Template for segment filenames
     * @param baseUrl - Base URL for segment access
     * @param maxSegments - Maximum number of segments in playlist
     */
    static getHlsOptions(
        segmentDir: string,
        segmentTemplate: string,
        baseUrl: string,
        maxSegments: number = 6
    ): string[] {
        return [
            '-hls_time 4',
            `-hls_list_size ${maxSegments}`,
            '-hls_flags delete_segments+independent_segments',
            '-hls_playlist_type event',
            `-hls_base_url ${baseUrl}`,
            `-hls_segment_filename ${segmentTemplate}`,
        ];
    }

    /**
     * Add stream mapping options for selected audio/video streams
     * @param audioStreamIndex - Index of the audio stream
     * @param videoStreamIndex - Index of the video stream
     */
    static getStreamMappingOptions(
        audioStreamIndex?: number,
        videoStreamIndex?: number
    ): string[] {
        const options: string[] = [];

        if (audioStreamIndex !== undefined) {
            options.push(`-map 0:${audioStreamIndex}`);
        }
        if (videoStreamIndex !== undefined) {
            options.push(`-map 0:${videoStreamIndex}`);
        }

        return options;
    }

    /**
     * Check if video codec needs transcoding
     * @param sourceCodec - The source video codec
     * @param targetCodecs - List of supported target codecs
     */
    static needsVideoTranscode(
        sourceCodec: string | null,
        targetCodecs: string[]
    ): boolean {
        if (!sourceCodec || sourceCodec.length === 0) return true;
        return !targetCodecs.includes(sourceCodec);
    }

    /**
     * Check if audio codec needs transcoding
     * @param sourceCodec - The source audio codec
     * @param targetCodecs - List of supported target codecs
     */
    static needsAudioTranscode(
        sourceCodec: string | null,
        targetCodecs: string[]
    ): boolean {
        if (!sourceCodec || sourceCodec.length === 0) return true;
        return !targetCodecs.includes(sourceCodec);
    }
}
