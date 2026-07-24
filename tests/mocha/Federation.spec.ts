import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Sequelize } from 'sequelize';
import NodeRSA from 'node-rsa';

import FederationClient from '../../src/lib/federation/client/FederationClient.js';
import FederationDataClient from '../../src/lib/federation/client/FederationDataClient.js';
import FederationMediaClient from '../../src/lib/federation/client/FederationMediaClient.js';
import FederationClientController from '../../src/lib/federation/client/FederationClientController.js';
import FederationServerConnection from '../../src/lib/federation/server/FederationServerConnection.js';
import FederationDataServerConnection from '../../src/lib/federation/server/FederationDataServerConnection.js';
import FederationMediaServerConnection from '../../src/lib/federation/server/FederationMediaServerConnection.js';

import { File, fileColumns } from '../../src/models/file.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import Queue from '../../src/lib/queue/index.js';
import logger from '../../src/submodules/logger/index.js';

import type Oblecto from '../../src/lib/oblecto/index.js';

class FakeSocket extends EventEmitter {
    written: string[] = [];
    destroyed = false;
    piped: any = null;

    write(data: string): boolean {
        this.written.push(data);
        return true;
    }

    destroy(): void {
        this.destroyed = true;
        this.emit('close');
    }

    pipe(dest: any): any {
        this.piped = dest;
        return dest;
    }
}

describe('Federation', () => {
    let tmpDir: string;
    let keyPath: string;

    before(async () => {
        logger.silent = true;
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-federation-'));

        const key = new NodeRSA({ b: 512 });
        keyPath = path.join(tmpDir, 'key.pem');
        await fs.writeFile(keyPath, key.exportKey('private'));
    });

    after(async () => {
        logger.silent = false;
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    const makeOblecto = (overrides: Record<string, any> = {}) => ({
        config: {
            federation: {
                uuid: 'client-uuid',
                key: keyPath,
                servers: { serverA: { address: 'localhost', ca: keyPath, dataPort: 9001, mediaPort: 9002 } },
                clients: { 'client-uuid': { key: keyPath } }
            }
        },
        queue: new Queue(1),
        ...overrides
    }) as unknown as Oblecto;

    describe('FederationClient', () => {
        it('buffers partial data and only dispatches complete lines', () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            const handled: string[] = [];
            client.headerHandler = (data: string) => { handled.push(data); };

            client.dataHandler(Buffer.from('AUTH:ACCE'));
            assert.deepEqual(handled, []);

            client.dataHandler(Buffer.from('PTED\n'));
            assert.deepEqual(handled, ['AUTH:ACCEPTED']);
        });

        it('dispatches multiple complete lines from a single chunk', () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            const handled: string[] = [];
            client.headerHandler = (data: string) => { handled.push(data); };

            client.dataHandler(Buffer.from('AUTH:ACCEPTED\nAUTH:ACCEPTED\n'));
            assert.deepEqual(handled, ['AUTH:ACCEPTED', 'AUTH:ACCEPTED']);
        });

        it('routes AUTH:ACCEPTED to authenticated state and emits auth', () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            let authEmitted = false;
            client.eventEmitter.on('auth', () => { authEmitted = true; });

            client.headerHandler('AUTH:ACCEPTED');

            assert.equal(client.authenticated, true);
            assert.equal(authEmitted, true);
        });

        it('closes the connection when AUTH is denied', () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.headerHandler('AUTH:DENIED');

            assert.equal(client.authenticated, false);
            assert.equal(socket.destroyed, true);
        });

        it('decrypts a CHALLENGE using the configured private key and echoes it back', async () => {
            const rsaKey = new NodeRSA(await fs.readFile(keyPath));
            const challenge = 'random-challenge-value';
            const encrypted = rsaKey.encrypt(challenge, 'base64');

            const client = new FederationClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            await client.challengeHandler(encrypted);

            assert.equal(socket.written[0], `CHALLENGE:${challenge}\n`);
        });

        it('write() formats header:content on the socket', () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.write('SYNC', 'FULL');

            assert.deepEqual(socket.written, ['SYNC:FULL\n']);
        });

        it('close() destroys the socket', () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.close();

            assert.equal(socket.destroyed, true);
        });

        it('waitForAuth resolves once the auth event fires', async () => {
            const client = new FederationClient(makeOblecto(), 'serverA');
            const waiter = client.waitForAuth();

            client.headerHandler('AUTH:ACCEPTED');

            await waiter;
        });
    });

    describe('FederationDataClient', () => {
        it('uses the configured dataPort', () => {
            const client = new FederationDataClient(makeOblecto(), 'serverA');
            assert.equal(client.port, 9001);
        });

        it('requestFullSync writes SYNC:FULL', () => {
            const client = new FederationDataClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.requestFullSync();

            assert.deepEqual(socket.written, ['SYNC:FULL\n']);
        });

        it('queues a federationIndexEpisode job with the server as host', async () => {
            const queued: Array<{ id: string; attr: any }> = [];
            const oblecto = makeOblecto({ queue: { queueJob: (id: string, attr: any) => queued.push({ id, attr }) } });
            const client = new FederationDataClient(oblecto, 'serverA');

            const payload = { id: 1, fileInfo: { type: 'episode', episode: 1, season: 1 } };
            const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');

            await client.fileHandler(encoded);

            assert.equal(queued.length, 1);
            assert.equal(queued[0].id, 'federationIndexEpisode');
            assert.equal(queued[0].attr.host, 'serverA');
        });

        it('queues a federationIndexMovie job for movie file types', async () => {
            const queued: Array<{ id: string; attr: any }> = [];
            const oblecto = makeOblecto({ queue: { queueJob: (id: string, attr: any) => queued.push({ id, attr }) } });
            const client = new FederationDataClient(oblecto, 'serverA');

            const payload = { id: 2, fileInfo: { type: 'movie', tmdbid: 5 } };
            const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');

            await client.fileHandler(encoded);

            assert.equal(queued[0].id, 'federationIndexMovie');
        });
    });

    describe('FederationMediaClient', () => {
        it('uses the configured mediaPort', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            assert.equal(client.port, 9002);
        });

        it('startStreamFile writes FILEID and stores it', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.startStreamFile('42');

            assert.equal(client.fileId, '42');
            assert.deepEqual(socket.written, ['FILEID:42\n']);
        });

        it('setStreamDestination destroys the socket when the destination closes', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            const dest = new EventEmitter() as any;
            client.setStreamDestination(dest);
            dest.emit('close');

            assert.equal(socket.destroyed, true);
        });

        it('readyHandler pipes and starts the stream when the file id matches', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;
            client.fileId = '42';

            const dest = new EventEmitter() as any;
            client.setStreamDestination(dest);

            client.readyHandler('42');

            assert.equal(socket.piped, dest);
            assert.ok(socket.written.includes('START:START\n'));
        });

        it('readyHandler destroys the socket when the file id does not match', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;
            client.fileId = '42';

            client.readyHandler('99');

            assert.equal(socket.destroyed, true);
        });

        it('setStreamOffset writes OFFSET', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.setStreamOffset(30);

            assert.deepEqual(socket.written, ['OFFSET:30\n']);
        });

        it('closeConnection destroys the socket', () => {
            const client = new FederationMediaClient(makeOblecto(), 'serverA');
            const socket = new FakeSocket();
            client.socket = socket as any;

            client.closeConnection();

            assert.equal(socket.destroyed, true);
        });
    });

    describe('FederationClientController', () => {
        const originalConnect = FederationDataClient.prototype.connect;
        const originalRequestFullSync = FederationDataClient.prototype.requestFullSync;
        const originalClose = FederationDataClient.prototype.close;

        afterEach(() => {
            FederationDataClient.prototype.connect = originalConnect;
            FederationDataClient.prototype.requestFullSync = originalRequestFullSync;
            FederationDataClient.prototype.close = originalClose;
        });

        it('connects to and requests a full sync from every configured server', async () => {
            const connected: string[] = [];
            const synced: string[] = [];

            FederationDataClient.prototype.connect = async function (this: FederationDataClient) { connected.push(this.serverName); };
            FederationDataClient.prototype.requestFullSync = function (this: FederationDataClient) { synced.push(this.serverName); };

            const controller = new FederationClientController(makeOblecto());
            await controller.addAllSyncMasters();

            assert.deepEqual(connected, ['serverA']);
            assert.deepEqual(synced, ['serverA']);
            assert.equal(controller.syncServers.length, 1);
        });

        it('close() closes every sync server connection', async () => {
            FederationDataClient.prototype.connect = async function () {};
            FederationDataClient.prototype.requestFullSync = function () {};

            const closed: string[] = [];
            FederationDataClient.prototype.close = function (this: FederationDataClient) { closed.push(this.serverName); };

            const controller = new FederationClientController(makeOblecto());
            await controller.addSyncMaster('serverA');

            controller.close();

            assert.deepEqual(closed, ['serverA']);
        });
    });

    describe('FederationServerConnection', () => {
        it('buffers partial data and only dispatches complete lines', () => {
            const socket = new FakeSocket();
            const connection = new FederationServerConnection(makeOblecto(), socket as any);

            const handled: string[] = [];
            connection.headerHandler = async (data: string) => { handled.push(data); };

            connection.dataHandler(Buffer.from('IAM:cli'));
            assert.deepEqual(handled, []);

            connection.dataHandler(Buffer.from('ent-uuid\n'));
            assert.deepEqual(handled, ['IAM:client-uuid']);
        });

        it('sends an encrypted CHALLENGE for a known client id', async () => {
            const socket = new FakeSocket();
            const connection = new FederationServerConnection(makeOblecto(), socket as any);

            await connection.clientIdHandler('client-uuid');

            assert.equal(connection.clientId, 'client-uuid');
            assert.equal(socket.written.length, 1);
            assert.ok(socket.written[0].startsWith('CHALLENGE:'));

            const rsaKey = new NodeRSA(await fs.readFile(keyPath));
            const sentChallenge = socket.written[0].replace('CHALLENGE:', '').replace('\n', '');
            const decrypted = rsaKey.decrypt(sentChallenge, 'ascii');
            assert.equal(decrypted, connection.challenge);
        });

        it('ignores unknown client ids without sending a challenge', async () => {
            const socket = new FakeSocket();
            const connection = new FederationServerConnection(makeOblecto(), socket as any);

            await connection.clientIdHandler('unknown-client');

            assert.equal(socket.written.length, 0);
        });

        it('authenticates when the returned challenge matches', () => {
            const socket = new FakeSocket();
            const connection = new FederationServerConnection(makeOblecto(), socket as any);

            connection.authHandler(connection.challenge);

            assert.equal(connection.authenticated, true);
            assert.deepEqual(socket.written, ['AUTH:ACCEPTED\n']);
        });

        it('denies and destroys the socket when the challenge does not match', () => {
            const socket = new FakeSocket();
            const connection = new FederationServerConnection(makeOblecto(), socket as any);

            connection.authHandler('wrong-value');

            assert.equal(connection.authenticated, false);
            assert.deepEqual(socket.written, ['AUTH:DENIED\n']);
            assert.equal(socket.destroyed, true);
        });

        it('destroys the socket for any header before authentication', async () => {
            const socket = new FakeSocket();
            const connection = new FederationServerConnection(makeOblecto(), socket as any);

            await connection.headerHandler('SOMETHING:ELSE');

            assert.equal(socket.destroyed, true);
        });
    });

    describe('FederationDataServerConnection + FederationMediaServerConnection (with Sequelize)', () => {
        let sequelize: Sequelize;

        before(async () => {
            sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

            File.init(fileColumns, { sequelize, modelName: 'File' });
            Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
            MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
            Series.init(seriesColumns, { sequelize, modelName: 'Series' });
            Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
            EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });

            Episode.belongsTo(Series);
            Series.hasMany(Episode);

            Movie.belongsToMany(File, { through: MovieFiles });
            File.belongsToMany(Movie, { through: MovieFiles });

            File.belongsToMany(Episode, { through: EpisodeFiles });
            Episode.belongsToMany(File, { through: EpisodeFiles });

            await sequelize.sync({ force: true });
        });

        afterEach(async () => {
            await Episode.destroy({ where: {}, truncate: true, cascade: true });
            await Series.destroy({ where: {}, truncate: true, cascade: true });
            await File.destroy({ where: {}, truncate: true, cascade: true });
            await Movie.destroy({ where: {}, truncate: true, cascade: true });
        });

        it('syncHandler starts a full sync only when permitted', () => {
            const socket = new FakeSocket();
            const connection = new FederationDataServerConnection(makeOblecto(), socket as any);

            let started = false;
            connection.startFullSync = async () => { started = true; };

            const result = connection.syncHandler('FULL');
            assert.equal(result, true);
            assert.equal(started, true);
        });

        it('syncHandler refuses a full sync when not permitted', () => {
            const socket = new FakeSocket();
            const connection = new FederationDataServerConnection(makeOblecto(), socket as any);
            connection.fullSyncPermitted = false;

            let started = false;
            connection.startFullSync = async () => { started = true; };

            const result = connection.syncHandler('FULL');
            assert.equal(result, false);
            assert.equal(started, false);
        });

        it('syncFiles writes a base64-encoded FILE payload for a stored movie file', async () => {
            const movie = await Movie.create({ tmdbid: 82744 });
            const file = await File.create({ duration: 100, host: 'local' });
            await movie.addFile(file);

            const socket = new FakeSocket();
            const connection = new FederationDataServerConnection(makeOblecto(), socket as any);

            await connection.syncFiles();

            assert.ok(socket.written.length >= 1);
            const decoded = JSON.parse(Buffer.from(socket.written[0].replace('FILE:', '').trim(), 'base64').toString());
            assert.equal(decoded.id, file.id);
        });

        it('FederationMediaServerConnection.setFileId looks up the file and replies READY', async () => {
            const file = await File.create({ host: 'local', path: '/x.mkv' });

            const socket = new FakeSocket();
            const connection = new FederationMediaServerConnection(makeOblecto(), socket as any);

            await connection.setFileId(String(file.id));

            assert.equal(connection.fileInfo?.id, file.id);
            assert.deepEqual(socket.written, [`READY:${file.id}\n`]);
        });

        it('FederationMediaServerConnection.setOffset stores a numeric offset', () => {
            const socket = new FakeSocket();
            const connection = new FederationMediaServerConnection(makeOblecto(), socket as any);

            connection.setOffset('45');

            assert.equal(connection.offset, 45);
        });
    });
});
