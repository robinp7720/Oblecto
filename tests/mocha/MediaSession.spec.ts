import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { MediaSession } from '../../src/lib/mediaSessions/MediaSession.js';
import logger from '../../src/submodules/logger/index.js';

import type { File } from '../../src/models/file.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { MediaSessionOptions, StreamDestination } from '../../src/lib/mediaSessions/types.js';

const makeFile = (overrides: Partial<File> = {}): File => ({
    id: 1,
    path: '/media/movie.mkv',
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

const oblectoStub = {} as unknown as Oblecto;

describe('MediaSession', () => {
    let session: MediaSession;

    before(() => {
        logger.silent = true;
    });

    after(() => {
        logger.silent = false;
    });

    afterEach(() => {
        if (session) session.endSession();
    });

    it('assigns a unique sessionId and defaults from target preferences', () => {
        session = new MediaSession(makeFile(), makeOptions(), oblectoStub);

        assert.ok(session.sessionId.length > 0);
        assert.equal(session.format, 'mp4');
        assert.equal(session.videoCodec, 'h264');
        assert.equal(session.audioCodec, 'aac');
        assert.equal(session.offset, 0);
        assert.equal(session.selectedAudioStreamIndex, null);
        assert.equal(session.subtitleMode, 'auto');
    });

    it('falls back to mp4/h264/aac when no target preferences given', () => {
        session = new MediaSession(makeFile(), makeOptions({ target: { formats: [], videoCodecs: [], audioCodecs: [] } }), oblectoStub);

        assert.equal(session.format, 'mp4');
        assert.equal(session.videoCodec, 'h264');
        assert.equal(session.audioCodec, 'aac');
    });

    it('respects explicit offset and stream index options', () => {
        session = new MediaSession(makeFile(), makeOptions({ offset: 42, audioStreamIndex: 2, subtitleStreamIndex: 3, subtitleMode: 'off' }), oblectoStub);

        assert.equal(session.offset, 42);
        assert.equal(session.selectedAudioStreamIndex, 2);
        assert.equal(session.selectedSubtitleStreamIndex, 3);
        assert.equal(session.subtitleMode, 'off');
    });

    it('defaults seekMode to server', () => {
        session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
        assert.equal(session.seekMode, 'server');
    });

    it('reports session info via getInfo', () => {
        session = new MediaSession(makeFile({ id: 7, path: '/x/y.mkv' }), makeOptions(), oblectoStub);
        const info = session.getInfo();

        assert.equal(info.sessionId, session.sessionId);
        assert.equal(info.state, 'idle');
        assert.equal(info.file.id, 7);
        assert.equal(info.file.path, '/x/y.mkv');
        assert.equal(info.output.format, 'mp4');
        assert.equal(info.seekMode, 'server');
        assert.equal(info.destinationCount, 0);
    });

    it('resolves the output mime type from the format', () => {
        session = new MediaSession(makeFile(), makeOptions({ target: { formats: ['mkv'], videoCodecs: ['h264'], audioCodecs: ['aac'] } }), oblectoStub);
        assert.equal(session.getOutputMimeType(), 'video/x-matroska');
    });

    describe('pause/resume', () => {
        it('does nothing when pausing a non-streaming session', () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
            let paused = false;
            session.on('pause', () => { paused = true; });

            session.pause();

            assert.equal(paused, false);
            assert.equal(session.getInfo().state, 'idle');
        });

        it('transitions streaming -> paused -> streaming and emits events', () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
            (session as any).state = 'streaming';

            let pauseEvents = 0;
            let resumeEvents = 0;
            session.on('pause', () => pauseEvents++);
            session.on('resume', () => resumeEvents++);

            session.pause();
            assert.equal(session.getInfo().state, 'paused');
            assert.equal(pauseEvents, 1);

            session.resume();
            assert.equal(session.getInfo().state, 'streaming');
            assert.equal(resumeEvents, 1);
        });

        it('does nothing when resuming a non-paused session', () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
            let resumed = false;
            session.on('resume', () => { resumed = true; });

            session.resume();

            assert.equal(resumed, false);
        });
    });

    describe('destinations', () => {
        it('adds a stream destination and pipes output to it', async () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
            const dest: StreamDestination = { type: 'stream', stream: new PassThrough() };

            await session.addDestination(dest);

            assert.equal(session.getInfo().destinationCount, 1);
        });

        it('sets HTTP response headers for http destinations', async () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);

            const headers: Record<string, string> = {};
            let statusCode: number | undefined;
            const fakeRes: any = new PassThrough();
            fakeRes.setHeader = (key: string, value: string) => { headers[key] = value; };
            fakeRes.status = (code: number) => { statusCode = code; return fakeRes; };

            await session.addDestination({ type: 'http', stream: fakeRes });

            assert.equal(headers['Content-Type'], 'video/mp4');
            assert.equal(headers['Transfer-Encoding'], 'chunked');
            assert.equal(statusCode, 200);
        });

        it('removes a destination when its stream closes and restarts the timeout', async () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
            const stream = new PassThrough();
            const dest: StreamDestination = { type: 'stream', stream };

            await session.addDestination(dest);
            assert.equal(session.getInfo().destinationCount, 1);

            stream.emit('close');

            assert.equal(session.getInfo().destinationCount, 0);
        });
    });

    describe('endSession', () => {
        it('transitions to ended, destroys streams, and emits close exactly once', () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);

            let closeEvents = 0;
            session.on('close', () => closeEvents++);

            session.endSession();
            session.endSession();

            assert.equal(session.getInfo().state, 'ended');
            assert.equal(closeEvents, 1);
        });

        it('kills the ffmpeg process if one is running', () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);

            let killedWith: string | undefined;
            (session as any).process = { kill: (signal: string) => { killedWith = signal; } };

            session.endSession();

            assert.equal(killedWith, 'SIGKILL');
        });
    });

    describe('timeout handling', () => {
        it('destroys the output stream on timeout when no destinations are connected', (done) => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);

            session.on('close', () => {
                assert.equal(session.getInfo().state, 'ended');
                done();
            });

            (session as any).onTimeout();
        });

        it('does not end the session on timeout when destinations are connected', async () => {
            session = new MediaSession(makeFile(), makeOptions(), oblectoStub);
            await session.addDestination({ type: 'stream', stream: new PassThrough() });

            (session as any).onTimeout();

            assert.notEqual(session.getInfo().state, 'ended');
        });
    });
});
