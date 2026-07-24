import assert from 'node:assert/strict';
import { FfmpegConfig } from '../../src/lib/mediaSessions/utils/FfmpegConfig.js';
import type { IConfig } from '../../src/interfaces/config.js';

const baseConfig = () => ({
    transcoding: {
        transcodeEverything: false,
        hardwareAcceleration: false,
        hardwareAccelerator: 'cuda'
    }
}) as unknown as IConfig;

describe('FfmpegConfig', () => {
    describe('getHardwareAccelInputOptions', () => {
        it('returns just noaccurate_seek when hw accel disabled', () => {
            const options = FfmpegConfig.getHardwareAccelInputOptions(baseConfig());
            assert.deepEqual(options, ['-noaccurate_seek']);
        });

        it('adds hwaccel flag when enabled', () => {
            const config = baseConfig();
            config.transcoding.hardwareAcceleration = true;
            config.transcoding.hardwareAccelerator = 'cuda';

            const options = FfmpegConfig.getHardwareAccelInputOptions(config);
            assert.ok(options.includes('-hwaccel cuda'));
        });

        it('adds vaapi output format flag for vaapi accelerator', () => {
            const config = baseConfig();
            config.transcoding.hardwareAcceleration = true;
            config.transcoding.hardwareAccelerator = 'vaapi';

            const options = FfmpegConfig.getHardwareAccelInputOptions(config);
            assert.ok(options.includes('-hwaccel vaapi'));
            assert.ok(options.includes('-hwaccel_output_format vaapi'));
        });
    });

    describe('getVideoCodec', () => {
        it('returns copy for null/empty/copy target codec', () => {
            const config = baseConfig();
            assert.equal(FfmpegConfig.getVideoCodec(null, config), 'copy');
            assert.equal(FfmpegConfig.getVideoCodec('', config), 'copy');
            assert.equal(FfmpegConfig.getVideoCodec('copy', config), 'copy');
        });

        it('maps to software encoders without hw acceleration', () => {
            const config = baseConfig();
            assert.equal(FfmpegConfig.getVideoCodec('h264', config), 'libx264');
            assert.equal(FfmpegConfig.getVideoCodec('hevc', config), 'libx265');
            assert.equal(FfmpegConfig.getVideoCodec('h265', config), 'libx265');
            assert.equal(FfmpegConfig.getVideoCodec('vp9', config), 'libvpx-vp9');
        });

        it('passes through unknown codecs unchanged', () => {
            const config = baseConfig();
            assert.equal(FfmpegConfig.getVideoCodec('mpeg2video', config), 'mpeg2video');
        });

        it('maps to nvenc encoders with cuda acceleration', () => {
            const config = baseConfig();
            config.transcoding.hardwareAcceleration = true;
            config.transcoding.hardwareAccelerator = 'cuda';

            assert.equal(FfmpegConfig.getVideoCodec('h264', config), 'h264_nvenc');
            assert.equal(FfmpegConfig.getVideoCodec('hevc', config), 'hevc_nvenc');
        });

        it('maps to vaapi encoders with vaapi acceleration', () => {
            const config = baseConfig();
            config.transcoding.hardwareAcceleration = true;
            config.transcoding.hardwareAccelerator = 'vaapi';

            assert.equal(FfmpegConfig.getVideoCodec('h264', config), 'h264_vaapi');
            assert.equal(FfmpegConfig.getVideoCodec('hevc', config), 'hevc_vaapi');
        });
    });

    describe('getTranscodeOutputOptions', () => {
        it('includes fragmented mp4 options', () => {
            const options = FfmpegConfig.getTranscodeOutputOptions(baseConfig());
            assert.ok(options.some(o => o.includes('frag_keyframe')));
        });

        it('adds yuv420p pixel format for cuda acceleration', () => {
            const config = baseConfig();
            config.transcoding.hardwareAcceleration = true;
            config.transcoding.hardwareAccelerator = 'cuda';

            const options = FfmpegConfig.getTranscodeOutputOptions(config);
            assert.ok(options.includes('-pix_fmt yuv420p'));
        });

        it('does not add pixel format for vaapi acceleration', () => {
            const config = baseConfig();
            config.transcoding.hardwareAcceleration = true;
            config.transcoding.hardwareAccelerator = 'vaapi';

            const options = FfmpegConfig.getTranscodeOutputOptions(config);
            assert.ok(!options.includes('-pix_fmt yuv420p'));
        });
    });

    describe('getHlsOptions', () => {
        it('builds hls option flags with the given parameters', () => {
            const options = FfmpegConfig.getHlsOptions('/tmp/segdir', '/tmp/segdir/seg%d.ts', 'http://host/segs/', 8);

            assert.ok(options.includes('-hls_time 4'));
            assert.ok(options.includes('-hls_list_size 8'));
            assert.ok(options.includes('-hls_base_url http://host/segs/'));
            assert.ok(options.includes('-hls_segment_filename /tmp/segdir/seg%d.ts'));
        });

        it('defaults maxSegments to 6', () => {
            const options = FfmpegConfig.getHlsOptions('/tmp', '/tmp/seg%d.ts', 'http://host/');
            assert.ok(options.includes('-hls_list_size 6'));
        });
    });

    describe('getStreamMappingOptions', () => {
        it('returns empty array when nothing selected', () => {
            assert.deepEqual(FfmpegConfig.getStreamMappingOptions(), []);
        });

        it('maps audio, video and subtitle indices when provided', () => {
            const options = FfmpegConfig.getStreamMappingOptions(2, 0, 3);
            assert.deepEqual(options, ['-map 0:2', '-map 0:0', '-map 0:3']);
        });

        it('omits subtitle mapping when null', () => {
            const options = FfmpegConfig.getStreamMappingOptions(1, 0, null);
            assert.deepEqual(options, ['-map 0:1', '-map 0:0']);
        });
    });

    describe('getExplicitStreamMappingOptions', () => {
        it('defaults to first audio stream when none specified', () => {
            const options = FfmpegConfig.getExplicitStreamMappingOptions();
            assert.deepEqual(options, ['-map 0:v:0', '-map 0:a:0']);
        });

        it('uses explicit audio stream index when given', () => {
            const options = FfmpegConfig.getExplicitStreamMappingOptions(4);
            assert.deepEqual(options, ['-map 0:v:0', '-map 0:4']);
        });

        it('adds subtitle mapping when given', () => {
            const options = FfmpegConfig.getExplicitStreamMappingOptions(4, 7);
            assert.deepEqual(options, ['-map 0:v:0', '-map 0:4', '-map 0:7']);
        });
    });

    describe('needsVideoTranscode / needsAudioTranscode', () => {
        it('requires transcode when source codec is missing', () => {
            assert.equal(FfmpegConfig.needsVideoTranscode(null, ['h264']), true);
            assert.equal(FfmpegConfig.needsVideoTranscode('', ['h264']), true);
        });

        it('requires transcode when source codec is not in target list', () => {
            assert.equal(FfmpegConfig.needsVideoTranscode('hevc', ['h264']), true);
            assert.equal(FfmpegConfig.needsAudioTranscode('flac', ['aac']), true);
        });

        it('does not require transcode when codec already supported', () => {
            assert.equal(FfmpegConfig.needsVideoTranscode('h264', ['h264', 'hevc']), false);
            assert.equal(FfmpegConfig.needsAudioTranscode('aac', ['aac']), false);
        });
    });
});
