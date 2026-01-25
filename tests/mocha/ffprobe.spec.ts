
import expect from 'expect.js';
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
            expect(path).to.be('/path/to/video.mkv');
            callback(null, mockMetadata);
        };

        const result = await ffprobe('/path/to/video.mkv');
        expect(result).to.eql(mockMetadata);
    });

    it('should reject with error on failure', async function () {
        // @ts-ignore
        ffmpeg.ffprobe = (path: string, callback: (err: any, data: any) => void) => {
            callback(new Error('Probe failed'), null);
        };

        try {
            await ffprobe('/path/to/video.mkv');
            expect().fail('Should have thrown error');
        } catch (e: any) {
            expect(e.message).to.be('Probe failed');
        }
    });

    it('should reject with Error object if error is string', async function () {
        // @ts-ignore
        ffmpeg.ffprobe = (path: string, callback: (err: any, data: any) => void) => {
            callback('Probe failed string', null);
        };

        try {
            await ffprobe('/path/to/video.mkv');
            expect().fail('Should have thrown error');
        } catch (e: any) {
            expect(e).to.be.an(Error);
            expect(e.message).to.be('Probe failed string');
        }
    });
});
