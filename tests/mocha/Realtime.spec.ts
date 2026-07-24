import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize';

import RealtimeClient from '../../src/lib/realtime/RealtimeClient.js';
import RealtimeController from '../../src/lib/realtime/RealtimeController.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import logger from '../../src/submodules/logger/index.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

class FakeSocket extends EventEmitter {
    id = 'socket-1';
    disconnected = false;
    emitted: Array<{ event: string; payload: unknown }> = [];

    emit(event: string, payload?: unknown): boolean {
        this.emitted.push({ event, payload });
        return super.emit(event, payload);
    }

    disconnect(): void {
        this.disconnected = true;
    }
}

const makeOblecto = (overrides: Record<string, any> = {}) => ({
    config: { authentication: { secret: 'test-secret' } },
    ...overrides
}) as unknown as Oblecto;

describe('RealtimeClient', () => {
    let sequelize: Sequelize;

    before(async () => {
        logger.silent = true;
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        await sequelize.sync({ force: true });
    });

    after(() => { logger.silent = false; });

    afterEach(async () => {
        await TrackEpisode.destroy({ where: {}, truncate: true });
        await TrackMovie.destroy({ where: {}, truncate: true });
    });

    it('authenticates with a valid token and stores the decoded user', () => {
        const socket = new FakeSocket();
        const client = new RealtimeClient(makeOblecto(), socket as any);

        const token = jwt.sign({ id: 5 }, 'test-secret');
        socket.emit('authenticate', { token });
        client.authenticationHandler({ token });

        assert.equal(client.user?.id, 5);
        assert.equal(socket.disconnected, false);
    });

    it('disconnects the socket for an invalid token', () => {
        const socket = new FakeSocket();
        const client = new RealtimeClient(makeOblecto(), socket as any);

        client.authenticationHandler({ token: 'not-a-real-token' });

        assert.equal(client.user, null);
        assert.equal(socket.disconnected, true);
    });

    it('ignores playback updates until authenticated', () => {
        const socket = new FakeSocket();
        const client = new RealtimeClient(makeOblecto(), socket as any);

        client.playingHandler({ type: 'movie', movieId: '1', time: 10, progress: 0.5 });

        assert.deepEqual(client.storage.movie, {});
    });

    it('stores episode and movie playback once authenticated', () => {
        const socket = new FakeSocket();
        const client = new RealtimeClient(makeOblecto(), socket as any);
        client.authenticationHandler({ token: jwt.sign({ id: 1 }, 'test-secret') });

        client.playingHandler({ type: 'tv', episodeId: '10', time: 5, progress: 0.1 });
        client.playingHandler({ type: 'movie', movieId: '20', time: 8, progress: 0.2 });

        assert.equal(client.storage.series['10'].time, 5);
        assert.equal(client.storage.movie['20'].time, 8);
    });

    it('emits disconnect when the underlying socket disconnects', () => {
        const socket = new FakeSocket();
        const client = new RealtimeClient(makeOblecto(), socket as any);

        let emitted = false;
        client.on('disconnect', () => { emitted = true; });

        socket.emit('disconnect');
        client.disconnectHandler();

        assert.equal(emitted, true);
    });

    it('playEpisode/playMovie emit a play event on the socket', async () => {
        const socket = new FakeSocket();
        const client = new RealtimeClient(makeOblecto(), socket as any);

        await client.playEpisode('42');
        await client.playMovie('7');

        assert.deepEqual(socket.emitted, [
            { event: 'play', payload: { episodeId: '42' } },
            { event: 'play', payload: { movieId: '7' } }
        ]);
    });

    describe('saveEpisodeTrack / saveMovieTrack', () => {
        it('does nothing when there is no user', async () => {
            const socket = new FakeSocket();
            const client = new RealtimeClient(makeOblecto(), socket as any);
            client.storage.series['1'] = { episodeId: '1', time: 1, progress: 0.1, type: 'tv' };

            await client.saveEpisodeTrack('1');

            assert.equal(await TrackEpisode.count(), 0);
        });

        it('does nothing when there is no stored playback for the id', async () => {
            const socket = new FakeSocket();
            const client = new RealtimeClient(makeOblecto(), socket as any);
            client.authenticationHandler({ token: jwt.sign({ id: 1 }, 'test-secret') });

            await client.saveEpisodeTrack('missing');

            assert.equal(await TrackEpisode.count(), 0);
        });

        it('creates a track row scoped to the user+episode on first save, but leaves it queued for the next save', async () => {
            const socket = new FakeSocket();
            const client = new RealtimeClient(makeOblecto(), socket as any);
            client.authenticationHandler({ token: jwt.sign({ id: 1 }, 'test-secret') });
            client.storage.series['10'] = { episodeId: '10', time: 5, progress: 0.1, type: 'tv' };

            await client.saveEpisodeTrack('10');

            const rows = await TrackEpisode.findAll();
            assert.equal(rows.length, 1);
            assert.equal(rows[0].time, 5);
            assert.equal(rows[0].userId, 1);
            assert.equal(rows[0].episodeId, 10);
            // Documents actual behavior: entries are only cleared from
            // storage on update, not on initial creation.
            assert.ok(client.storage.series['10']);
        });

        it('matches the existing row for the same user+episode on a repeat save, updates it, and clears storage', async () => {
            const socket = new FakeSocket();
            const client = new RealtimeClient(makeOblecto(), socket as any);
            client.authenticationHandler({ token: jwt.sign({ id: 1 }, 'test-secret') });

            client.storage.series['10'] = { episodeId: '10', time: 1, progress: 0.01, type: 'tv' };
            await client.saveEpisodeTrack('10');

            client.storage.series['10'] = { episodeId: '10', time: 99, progress: 0.9, type: 'tv' };
            await client.saveEpisodeTrack('10');

            const rows = await TrackEpisode.findAll();
            assert.equal(rows.length, 1);
            assert.equal(rows[0].time, 99);
            assert.equal(rows[0].progress, 0.9);
            assert.equal(client.storage.series['10'], undefined);
        });

        it('scopes movie tracking to user+movie the same way', async () => {
            const socket = new FakeSocket();
            const client = new RealtimeClient(makeOblecto(), socket as any);
            client.authenticationHandler({ token: jwt.sign({ id: 3 }, 'test-secret') });

            client.storage.movie['20'] = { movieId: '20', time: 1, progress: 0.01, type: 'movie' };
            await client.saveMovieTrack('20');

            client.storage.movie['20'] = { movieId: '20', time: 50, progress: 0.5, type: 'movie' };
            await client.saveMovieTrack('20');

            const rows = await TrackMovie.findAll();
            assert.equal(rows.length, 1);
            assert.equal(rows[0].userId, 3);
            assert.equal(rows[0].movieId, 20);
            assert.equal(rows[0].time, 50);
            assert.equal(client.storage.movie['20'], undefined);
        });

        it('saveAllTracks processes every queued series and movie entry', async () => {
            const socket = new FakeSocket();
            const client = new RealtimeClient(makeOblecto(), socket as any);
            client.authenticationHandler({ token: jwt.sign({ id: 2 }, 'test-secret') });

            client.storage.series['1'] = { episodeId: '1', time: 1, progress: 0.1, type: 'tv' };
            client.storage.movie['2'] = { movieId: '2', time: 2, progress: 0.2, type: 'movie' };

            await client.saveAllTracks();

            assert.equal(await TrackEpisode.count(), 1);
            assert.equal(await TrackMovie.count(), 1);
        });
    });
});

describe('RealtimeController', () => {
    let httpServer: http.Server;

    before(() => { logger.silent = true; });
    after(() => { logger.silent = false; });

    beforeEach((done) => {
        httpServer = http.createServer();
        httpServer.listen(0, done);
    });

    afterEach((done) => {
        httpServer.close(() => done());
    });

    const makeControllerOblecto = () => makeOblecto({ oblectoAPI: { server: httpServer } });

    it('registers a RealtimeClient for each new connection and removes it on disconnect', () => {
        const controller = new RealtimeController(makeControllerOblecto());
        const socket = new FakeSocket();

        controller.connectionHandler(socket as any);

        assert.equal(Object.keys(controller.clients).length, 1);
        assert.ok(controller.clients[socket.id] instanceof RealtimeClient);

        socket.emit('disconnect');

        assert.equal(Object.keys(controller.clients).length, 0);

        controller.close();
    });

    it('broadcast emits an event to the underlying socket.io server', () => {
        const controller = new RealtimeController(makeControllerOblecto());

        let received: any;
        controller.server.on('connection', () => {});
        const originalEmit = controller.server.emit.bind(controller.server);
        controller.server.emit = ((event: string, payload: any) => {
            received = { event, payload };
            return originalEmit(event, payload);
        }) as any;

        controller.broadcast('indexer', { event: 'added' });

        assert.deepEqual(received, { event: 'indexer', payload: { event: 'added' } });

        controller.close();
    });
});
