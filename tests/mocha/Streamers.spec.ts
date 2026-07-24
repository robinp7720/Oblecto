import assert from 'node:assert/strict';
import { DirectStreamer, DirectStreamSession } from '../../src/lib/mediaSessions/streamers/DirectStreamer.js';
import { DirectHttpStreamer, DirectHttpStreamSession } from '../../src/lib/mediaSessions/streamers/DirectHttpStreamer.js';
import { TranscodeStreamer, TranscodeStreamSession } from '../../src/lib/mediaSessions/streamers/TranscodeStreamer.js';
import { HlsStreamer } from '../../src/lib/mediaSessions/streamers/HlsStreamer.js';
import { FederationStreamer } from '../../src/lib/mediaSessions/streamers/FederationStreamer.js';
import logger from '../../src/submodules/logger/index.js';

import type { File } from '../../src/models/file.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { MediaSessionOptions } from '../../src/lib/mediaSessions/types.js';

const makeFile = (overrides: Partial<File> = {}): File => ({
    id: 1,
    host: 'local',
    path: '/media/movie.mkv',
    extension: 'mkv',
    videoCodec: 'h264',
    audioCodec: 'aac',
    size: 1000,
    ...overrides
} as unknown as File);

const makeOptions = (overrides: Partial<MediaSessionOptions> = {}): MediaSessionOptions => ({
    target: {
        formats: ['mp4'],
        videoCodecs: ['h264'],
        audioCodecs: ['aac']
    },
    ...overrides
});

const makeOblecto = (overrides: Record<string, any> = {}) => ({
    config: {
        transcoding: { transcodeEverything: false, hardwareAcceleration: false, hardwareAccelerator: 'cuda' },
        streaming: { defaultTargetLanguageCode: 'eng' },
        ...overrides.config
    },
    ...overrides
}) as unknown as Oblecto;

describe('Streamers', () => {
    before(() => { logger.silent = true; });
    after(() => { logger.silent = false; });

    describe('DirectStreamer', () => {
        const streamer = new DirectStreamer();

        it('has type "direct" with lowest priority among the local streamers', () => {
            assert.equal(streamer.type, 'direct');
            assert.equal(streamer.priority, 10);
        });

        it('refuses remote files', () => {
            assert.equal(streamer.canHandle(makeFile({ host: 'remote-server' }), makeOptions(), makeOblecto()), false);
        });

        it('refuses when HLS is explicitly requested', () => {
            assert.equal(streamer.canHandle(makeFile(), makeOptions({ streamType: 'hls' }), makeOblecto()), false);
        });

        it('accepts local files otherwise', () => {
            assert.equal(streamer.canHandle(makeFile(), makeOptions(), makeOblecto()), true);
        });

        it('creates a DirectStreamSession with client seek mode', () => {
            const session = streamer.createSession(makeFile(), makeOptions(), makeOblecto());
            assert.ok(session instanceof DirectStreamSession);
            assert.equal(session.seekMode, 'client');
            session.endSession();
        });
    });

    describe('DirectHttpStreamer', () => {
        const streamer = new DirectHttpStreamer();

        it('has type "directhttp" with higher priority than direct', () => {
            assert.equal(streamer.type, 'directhttp');
            assert.equal(streamer.priority, 5);
        });

        it('refuses remote files', () => {
            assert.equal(streamer.canHandle(makeFile({ host: 'remote-server' }), makeOptions(), makeOblecto()), false);
        });

        it('refuses hls/transcode explicit requests', () => {
            assert.equal(streamer.canHandle(makeFile(), makeOptions({ streamType: 'hls' }), makeOblecto()), false);
            assert.equal(streamer.canHandle(makeFile(), makeOptions({ streamType: 'transcode' }), makeOblecto()), false);
            assert.equal(streamer.canHandle(makeFile(), makeOptions({ streamType: 'recode' }), makeOblecto()), false);
        });

        it('accepts when file container matches a target format', () => {
            assert.equal(streamer.canHandle(makeFile({ extension: 'mp4' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: [], audioCodecs: [] } }), makeOblecto()), true);
        });

        it('refuses when file container does not match any target format', () => {
            assert.equal(streamer.canHandle(makeFile({ extension: 'avi' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: [], audioCodecs: [] } }), makeOblecto()), false);
        });

        it('creates a DirectHttpStreamSession using the file extension as format', () => {
            const session = streamer.createSession(makeFile({ extension: 'mkv' }), makeOptions(), makeOblecto());
            assert.ok(session instanceof DirectHttpStreamSession);
            assert.equal(session.format, 'mkv');
            assert.equal(session.seekMode, 'client');
            session.endSession();
        });
    });

    describe('TranscodeStreamer', () => {
        const streamer = new TranscodeStreamer();

        it('has type "transcode" with the lowest priority (fallback)', () => {
            assert.equal(streamer.type, 'transcode');
            assert.equal(streamer.priority, 100);
        });

        it('refuses remote files', () => {
            assert.equal(streamer.canHandle(makeFile({ host: 'remote-server' }), makeOptions(), makeOblecto()), false);
        });

        it('refuses when HLS is explicitly requested', () => {
            assert.equal(streamer.canHandle(makeFile(), makeOptions({ streamType: 'hls' }), makeOblecto()), false);
        });

        it('always handles when transcodeEverything is set', () => {
            const oblecto = makeOblecto({ config: { transcoding: { transcodeEverything: true } } });
            assert.equal(streamer.canHandle(makeFile({ extension: 'mp4', videoCodec: 'h264', audioCodec: 'aac' }), makeOptions(), oblecto), true);
        });

        it('requires transcode when container does not match target', () => {
            assert.equal(streamer.canHandle(makeFile({ extension: 'avi' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: ['h264'], audioCodecs: ['aac'] } }), makeOblecto()), true);
        });

        it('requires transcode when video codec is unsupported', () => {
            assert.equal(streamer.canHandle(makeFile({ extension: 'mp4', videoCodec: 'hevc' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: ['h264'], audioCodecs: ['aac'] } }), makeOblecto()), true);
        });

        it('requires transcode when audio codec is unsupported', () => {
            assert.equal(streamer.canHandle(makeFile({ extension: 'mp4', videoCodec: 'h264', audioCodec: 'flac' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: ['h264'], audioCodecs: ['aac'] } }), makeOblecto()), true);
        });

        it('does not require transcode when everything already matches', () => {
            assert.equal(streamer.canHandle(makeFile({ extension: 'mp4', videoCodec: 'h264', audioCodec: 'aac' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: ['h264'], audioCodecs: ['aac'] } }), makeOblecto()), false);
        });

        it('creates a session that copies codecs that already match target', () => {
            const session = streamer.createSession(makeFile({ videoCodec: 'h264', audioCodec: 'aac' }), makeOptions({ target: { formats: ['mp4'], videoCodecs: ['h264'], audioCodecs: ['aac'] } }), makeOblecto());
            assert.ok(session instanceof TranscodeStreamSession);
            assert.equal(session.videoCodec, 'copy');
            assert.equal(session.audioCodec, 'copy');
            session.endSession();
        });

        it('defaults targetLanguageCode from config', () => {
            const session = streamer.createSession(makeFile(), makeOptions(), makeOblecto()) as TranscodeStreamSession;
            assert.equal(session.targetLanguageCode, 'eng');
            session.endSession();
        });
    });

    describe('HlsStreamer', () => {
        const streamer = new HlsStreamer();

        it('has type "hls"', () => {
            assert.equal(streamer.type, 'hls');
        });

        it('refuses remote files', () => {
            assert.equal(streamer.canHandle(makeFile({ host: 'remote-server' }), makeOptions({ streamType: 'hls' }), makeOblecto()), false);
        });

        it('only handles explicit hls requests', () => {
            assert.equal(streamer.canHandle(makeFile(), makeOptions(), makeOblecto()), false);
            assert.equal(streamer.canHandle(makeFile(), makeOptions({ streamType: 'hls' }), makeOblecto()), true);
        });
    });

    describe('FederationStreamer', () => {
        const streamer = new FederationStreamer();

        it('has type "federation" with the highest priority', () => {
            assert.equal(streamer.type, 'federation');
            assert.equal(streamer.priority, 1);
        });

        it('only handles non-local (remote) files', () => {
            assert.equal(streamer.canHandle(makeFile({ host: 'local' }), makeOptions(), makeOblecto()), false);
            assert.equal(streamer.canHandle(makeFile({ host: 'remote-server-uuid' }), makeOptions(), makeOblecto()), true);
        });
    });
});
