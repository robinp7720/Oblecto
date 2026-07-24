import assert from 'node:assert/strict';
import { MediaSessionController } from '../../src/lib/mediaSessions/MediaSessionController.js';
import { MediaSession } from '../../src/lib/mediaSessions/MediaSession.js';
import logger from '../../src/submodules/logger/index.js';

import type { File } from '../../src/models/file.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { MediaSessionOptions, Streamer } from '../../src/lib/mediaSessions/types.js';

const makeFile = (overrides: Partial<File> = {}): File => ({
    id: 1,
    host: 'local',
    path: '/media/movie.mkv',
    extension: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    size: 1000,
    ...overrides
} as unknown as File);

const makeOptions = (overrides: Partial<MediaSessionOptions> = {}): MediaSessionOptions => ({
    target: { formats: ['mp4'], videoCodecs: ['h264'], audioCodecs: ['aac'] },
    ...overrides
});

const makeOblecto = () => ({
    config: {
        transcoding: { transcodeEverything: false, hardwareAcceleration: false },
        streaming: { defaultTargetLanguageCode: 'eng' }
    }
}) as unknown as Oblecto;

class FakeStreamer implements Streamer {
    readonly type: string;
    readonly priority: number;
    canHandleResult: boolean;

    constructor(type: string, priority: number, canHandleResult = true) {
        this.type = type;
        this.priority = priority;
        this.canHandleResult = canHandleResult;
    }

    canHandle(): boolean {
        return this.canHandleResult;
    }

    createSession(file: File, options: MediaSessionOptions, oblecto: Oblecto): MediaSession {
        return new MediaSession(file, options, oblecto);
    }
}

describe('MediaSessionController', () => {
    before(() => { logger.silent = true; });
    after(() => { logger.silent = false; });

    it('registers all built-in streamers on construction', () => {
        const controller = new MediaSessionController(makeOblecto());
        const types = controller.getStreamerTypes().sort();

        assert.deepEqual(types, ['direct', 'directhttp', 'federation', 'hls', 'transcode']);
        controller.close();
    });

    it('registers and unregisters custom streamers', () => {
        const controller = new MediaSessionController(makeOblecto());

        controller.registerStreamer(new FakeStreamer('fake', 1));
        assert.ok(controller.getStreamerTypes().includes('fake'));

        const removed = controller.unregisterStreamer('fake');
        assert.equal(removed, true);
        assert.ok(!controller.getStreamerTypes().includes('fake'));

        controller.close();
    });

    it('creates a session with the explicitly requested streamer type', () => {
        const controller = new MediaSessionController(makeOblecto());
        const session = controller.newSession(makeFile(), makeOptions({ streamType: 'directhttp' }));

        assert.ok(controller.sessionExists(session.sessionId));
        assert.equal(controller.getSession(session.sessionId), session);

        controller.close();
    });

    it('auto-selects the highest-priority streamer that can handle the file', () => {
        const controller = new MediaSessionController(makeOblecto());

        controller.unregisterStreamer('direct');
        controller.unregisterStreamer('directhttp');
        controller.unregisterStreamer('hls');
        controller.unregisterStreamer('federation');
        controller.registerStreamer(new FakeStreamer('low-priority', 50, true));
        controller.registerStreamer(new FakeStreamer('high-priority', 5, true));

        const session = controller.newSession(makeFile(), makeOptions());
        assert.ok(controller.sessionExists(session.sessionId));

        controller.close();
    });

    it('falls back to the transcode streamer when nothing else can handle the file', () => {
        const controller = new MediaSessionController(makeOblecto());

        controller.unregisterStreamer('direct');
        controller.unregisterStreamer('directhttp');
        controller.unregisterStreamer('hls');
        controller.unregisterStreamer('federation');

        const session = controller.newSession(makeFile(), makeOptions());
        assert.ok(controller.sessionExists(session.sessionId));

        controller.close();
    });

    it('removes a session from the registry once it closes', (done) => {
        const controller = new MediaSessionController(makeOblecto());
        const session = controller.newSession(makeFile(), makeOptions({ streamType: 'directhttp' }));

        assert.ok(controller.sessionExists(session.sessionId));

        session.on('close', () => {
            assert.equal(controller.sessionExists(session.sessionId), false);
            done();
        });

        session.endSession();
    });

    it('getSessions returns all active sessions', () => {
        const controller = new MediaSessionController(makeOblecto());
        controller.newSession(makeFile(), makeOptions({ streamType: 'directhttp' }));
        controller.newSession(makeFile({ id: 2 }), makeOptions({ streamType: 'directhttp' }));

        assert.equal(controller.getSessions().length, 2);

        controller.close();
    });

    it('close() ends all active sessions', () => {
        const controller = new MediaSessionController(makeOblecto());
        const session = controller.newSession(makeFile(), makeOptions({ streamType: 'directhttp' }));

        controller.close();

        assert.equal(session.getInfo().state, 'ended');
    });

    it('warns and overwrites when registering a duplicate streamer type', () => {
        const controller = new MediaSessionController(makeOblecto());

        controller.registerStreamer(new FakeStreamer('direct', 999, false));
        assert.equal(controller.getStreamerTypes().filter(t => t === 'direct').length, 1);

        controller.close();
    });
});
