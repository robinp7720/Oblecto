import assert from 'node:assert/strict';
import { getMimeType, getAudioMimeType } from '../../src/lib/mediaSessions/utils/MimeTypes.js';

describe('MimeTypes', () => {
    describe('getMimeType', () => {
        it('resolves known container formats', () => {
            assert.equal(getMimeType('mp4'), 'video/mp4');
            assert.equal(getMimeType('mkv'), 'video/x-matroska');
            assert.equal(getMimeType('matroska'), 'video/x-matroska');
            assert.equal(getMimeType('webm'), 'video/webm');
            assert.equal(getMimeType('hls'), 'application/x-mpegURL');
            assert.equal(getMimeType('m3u8'), 'application/x-mpegURL');
        });

        it('is case-insensitive', () => {
            assert.equal(getMimeType('MP4'), 'video/mp4');
            assert.equal(getMimeType('MKV'), 'video/x-matroska');
        });

        it('falls back to video/mp4 for unknown formats', () => {
            assert.equal(getMimeType('unknownformat'), 'video/mp4');
        });
    });

    describe('getAudioMimeType', () => {
        it('resolves known audio formats', () => {
            assert.equal(getAudioMimeType('mp3'), 'audio/mpeg');
            assert.equal(getAudioMimeType('flac'), 'audio/flac');
            assert.equal(getAudioMimeType('opus'), 'audio/opus');
        });

        it('is case-insensitive', () => {
            assert.equal(getAudioMimeType('MP3'), 'audio/mpeg');
        });

        it('falls back to audio/mpeg for unknown formats', () => {
            assert.equal(getAudioMimeType('unknownformat'), 'audio/mpeg');
        });
    });
});
