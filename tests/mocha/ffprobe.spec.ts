
import assert from 'node:assert/strict';
import ffprobe from '../../src/submodules/ffprobe.js';
import ffmpeg from '../../src/submodules/ffmpeg.js';
import { FfprobeData } from 'fluent-ffmpeg';

describe('ffprobe submodule', function () {
    let originalFfprobe: any;

    beforeEach(function () {
        originalFfprobe = ffmpeg.ffprobe;
    });

    afterEach(function () {
        ffmpeg.ffprobe = originalFfprobe;
    });

    it('should resolve with metadata on success', async function () {
        const mockMetadata: FfprobeData = {
            streams: [],
            format: {} as any,
            chapters: []
        };

        // @ts-ignore
        ffmpeg.ffprobe = (path: string, callback: (err: any, data: any) => void) => {
            assert.equal(path, '/path/to/video.mkv');
            callback(null, mockMetadata);
        };

        const result = await ffprobe('/path/to/video.mkv');
        assert.deepEqual(result, mockMetadata);
    });

    it('should reject with error on failure', async function () {
        // @ts-ignore
        ffmpeg.ffprobe = (path: string, callback: (err: any, data: any) => void) => {
            callback(new Error('Probe failed'), null);
        };

        try {
            await ffprobe('/path/to/video.mkv');
            assert.fail('Should have thrown error');
        } catch (e: any) {
            assert.equal(e.message, 'Probe failed');
        }
    });

    it('should reject with Error object if error is string', async function () {
        // @ts-ignore
        ffmpeg.ffprobe = (path: string, callback: (err: any, data: any) => void) => {
            callback('Probe failed string', null);
        };

        try {
            await ffprobe('/path/to/video.mkv');
            assert.fail('Should have thrown error');
        } catch (e: any) {
            assert.ok(e instanceof Error);
            assert.equal(e.message, 'Probe failed string');
        }
    });
});
