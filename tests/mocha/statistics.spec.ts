import sessionsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/sessions/index.js';
import { upsertPlaybackEntry, statisticsPlaybackId } from '../../src/lib/embyEmulation/ServerAPI/playbackState.js';
import { formatId } from '../../src/lib/embyEmulation/helpers.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import type EmbyEmulation from '../../src/lib/embyEmulation/index.js';
import assert from 'node:assert/strict';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Sequelize } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { File, fileColumns } from '../../src/models/file.js';
import { initStatisticsModels, ViewingSession, ViewingDay, PlaybackHealth } from '../../src/models/statistics.js';
import { StatisticsService } from '../../src/lib/statistics/StatisticsService.js';
import { StatisticsQueries, readPeriod } from '../../src/lib/statistics/queries.js';
import { account, initialCheckpoint, coverage } from '../../src/lib/statistics/accounting.js';
import statisticsRoutes from '../../src/submodules/REST/routes/v1/statistics.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import { seedGroups } from '../../src/lib/auth/permissions.js';
import config from '../../src/config.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';

const identity = { itemType: 'movie', itemId: 1, title: 'A remembered title' };
const period = { from: '2026-10-01', to: '2026-11-01' };

describe('Statistics accounting', () => {
    it('uses elapsed time at 2× and rejects stale, invalid, and duplicate telemetry', () => {
        const previous = initialCheckpoint(0);
        const result = account(previous, { position: 20, activeSeconds: 10, playedRanges: [[0, 20]], sequence: 1 }, 10000, 100)!;
        assert.equal(result.seconds, 10);
        assert.equal(coverage(result.checkpoint.ranges), 20);
        assert.equal(account(result.checkpoint, { position: 20, sequence: 1 }, 20000, 100), null);
        assert.equal(account(result.checkpoint, { position: 20, activeSeconds: -1, playedRanges: [], sequence: 2 }, 20000, 100), null);
        assert.equal(account(result.checkpoint, { position: Infinity }, 20000, 100), null);
    });
    it('estimates conservatively across seeks, buffering, pauses, and long gaps', () => {
        const previous = { ...initialCheckpoint(0), paused: false };
        assert.equal(account(previous, { position: 90 }, 10000, 100)!.seconds, 0);
        assert.equal(account(previous, { position: 10, paused: true }, 10000, 100)!.seconds, 10);
        assert.equal(account({ ...previous, paused: true }, { position: 10 }, 10000, 100)!.seconds, 0);
        assert.equal(account({ ...previous, buffering: true }, { position: 10 }, 10000, 100)!.seconds, 0);
        assert.equal(account(previous, { position: 90 }, 120000, 100)!.seconds, 0);
        assert.equal(account(previous, { position: 10 }, 10000, 0)!.completed, false);
        const unknown = account(previous, { position: 10, sequence: 1, activeSeconds: 10, playedRanges: [[0, 10]] }, 10000, 0)!;
        assert.equal(unknown.seconds, 10);
        assert.equal(unknown.completed, false);
        assert.deepEqual(unknown.checkpoint.ranges, []);
    });
    it('does not count repeated coverage twice or a seek to the credits as completion', () => {
        const first = account(initialCheckpoint(0), { position: 50, sequence: 1, activeSeconds: 50, playedRanges: [[0, 50]] }, 50000, 100)!;
        const repeated = account(first.checkpoint, { position: 50, sequence: 2, activeSeconds: 100, playedRanges: [[0, 50]] }, 100000, 100)!;
        assert.equal(coverage(repeated.checkpoint.ranges), 50);
        assert.equal(repeated.completed, false);
        const finished = account(repeated.checkpoint, { position: 90, sequence: 3, activeSeconds: 140, playedRanges: [[0, 90]] }, 140000, 100)!;
        assert.equal(finished.completed, true);
        assert.equal(account(initialCheckpoint(0), { position: 95 }, 1000, 100)!.completed, false);
    });
    it('validates real UTC calendar dates and bounded query ranges', () => {
        assert.throws(() => readPeriod({ from: '2026-02-30', to: '2026-03-02' }));
        assert.throws(() => readPeriod({ to: 'bad' }), (error: { statusCode: number }) => error.statusCode === 400);
        assert.throws(() => readPeriod({ from: '2020-01-01', to: '2026-01-01' }));
        assert.deepEqual(readPeriod(period, 3), { ...period, userId: 3 });
    });
});

describe('Statistics persistence and API', () => {
    let database: Sequelize;
    let service: StatisticsService;
    let queries: StatisticsQueries;
    let now: number;
    let owner: User;
    let other: User;
    let admin: User;
    let server: Server;
    let base: string;
    let emby: EmbyEmulation;

    beforeEach(async () => {
        database = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize: database, modelName: 'User' });
        Group.init(groupColumns, { sequelize: database, modelName: 'Group' });
        Movie.init(movieColumns, { sequelize: database, modelName: 'Movie' });
        Episode.init(episodeColumns, { sequelize: database, modelName: 'Episode' });
        Series.init(seriesColumns, { sequelize: database, modelName: 'Series' });
        File.init(fileColumns, { sequelize: database, modelName: 'File' });
        TrackMovie.init(trackMovieColumns, { sequelize: database, modelName: 'TrackMovie' });
        Movie.hasMany(File);
        File.belongsTo(Movie);
        initStatisticsModels(database);
        await database.sync();
        await seedGroups();
        owner = await User.create({ username: 'owner' });
        other = await User.create({ username: 'other' });
        const group = (await Group.findOne({ where: { name: 'Administrators' } }))!;
        admin = await User.create({ username: 'admin', groupId: group.id });
        now = Date.parse('2026-10-06T23:59:50Z');
        service = new StatisticsService(database, undefined, () => now);
        await service.settled();
        queries = new StatisticsQueries(database);
        const app = express();
        app.use(express.json());
        emby = { sessions: { 'jellyfin-token': { Id: owner.id } }, oblecto: { statistics: service, playback: { sessions: new Map() } } } as unknown as EmbyEmulation;
        sessionsRoutes(app, emby);
        app.use((request: OblectoRequest, _response, next) => {
            const [scheme, credentials] = (request.headers.authorization ?? '').split(' ');
            if (credentials) request.authorization = { scheme, credentials } as OblectoRequest['authorization'];
            next();
        });
        statisticsRoutes(app, { database, statistics: service } as Oblecto);
        app.use((error: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.statusCode ?? 500).json({ message: error.message });
        });
        server = app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterEach(async () => {
        await service.close();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await database.close();
    });
    const begin = (id = 'session', user?: User) => service.begin(id, (user ?? owner).id, null, 'web', 0, identity);
    const report = (id = 'session', activeSeconds = 20, sequence = 1, position = 40) => service.report(id, { position, activeSeconds, sequence, playedRanges: [[0, position]], paused: false }, 100, 'direct');
    const get = async (path: string, user?: User) => {
        const response = await fetch(base + path, { headers: user ? { Authorization: `Bearer ${issueAccessToken(user, config.authentication)}` } : {} });
        return { status: response.status, body: await response.json() };
    };

    it('checkpoints once, splits midnight, preserves deleted media snapshots, and stops idempotently', async () => {
        await begin();
        now += 20000;
        await Promise.all([report(), report()]);
        const row = (await ViewingSession.findByPk('session'))!;
        assert.equal(row.getDataValue('watchSeconds'), 20);
        const days = await ViewingDay.findAll({ order: [['day', 'ASC']] });
        assert.deepEqual(days.map(day => day.getDataValue('watchSeconds')), [10, 10]);
        await service.end('session');
        now += 10000;
        await report('session', 30, 2, 60);
        await service.end('session');
        await row.reload();
        assert.equal(row.getDataValue('watchSeconds'), 20);
        assert.equal(row.getDataValue('title'), identity.title);
        const summary = await queries.summary({ ...period, userId: owner.id }) as any;
        assert.equal(summary.totals.watchSeconds, 20);
        assert.equal(summary.totals.plays, 1);
        assert.equal(summary.totals.completions, 0);
    });
    it('completes once, counts a later repeat, and keeps resumed sessions separate', async () => {
        await begin();
        now += 45000;
        await report('session', 45, 1, 90);
        now += 1000;
        await report('session', 46, 2, 92);
        await service.end('session');
        await begin('again');
        now += 10000;
        await report('again', 10, 1, 20);
        const summary = await queries.summary({ ...period, userId: owner.id }) as any;
        assert.equal(summary.totals.completions, 1);
        assert.equal(summary.totals.plays, 2);
        assert.equal(summary.totals.repeatPlays, 1);
    });
    it('collects Jellyfin fallback reports and stops idempotently without persisting tokens', async () => {
        const movie = await Movie.create({ movieName: 'Jellyfin movie', runtime: 2 });
        await File.create({ MovieId: movie.id, duration: 100 } as never);
        const send = (path: string, position: number) => fetch(base + path, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-emby-token': 'jellyfin-token' },
            body: JSON.stringify({ ItemId: formatId(movie.id, 'movie'), PlaySessionId: 'play-1', PositionTicks: position * 10000000, PlayMethod: 'DirectPlay' })
        });
        assert.equal((await send('/sessions/playing', 0)).status, 204);
        now += 10000;
        assert.equal((await send('/sessions/playing/progress', 10)).status, 204);
        now += 10000;
        assert.equal((await send('/sessions/playing/stopped', 20)).status, 204);
        await send('/sessions/playing/stopped', 20);
        assert.equal(await ViewingSession.count(), 1);
        const record = (await ViewingSession.findOne())!;
        assert.equal(record.getDataValue('watchSeconds'), 20);
        assert.equal(record.getDataValue('quality'), 'estimated');
        assert.equal(record.getDataValue('bufferingReports'), null);
        assert.ok(!JSON.stringify(record.toJSON()).includes('jellyfin-token'));
    });
    it('uses one collector record when Jellyfin fallback transitions to a managed stream', async () => {
        const movie = await Movie.create({ movieName: 'Managed movie', runtime: 2 });
        const file = await File.create({ MovieId: movie.id, duration: 100 } as never);
        const id = statisticsPlaybackId('jellyfin-token', 'managed');
        await service.begin(id, owner.id, file, 'jellyfin', 0, { ...identity, itemId: movie.id });
        const playback = { sessionId: 'lease', statisticsId: id, owner: 'emby:jellyfin-token', revision: 1 };
        emby.oblecto.playback.sessions.set('lease', playback as never);
        emby.oblecto.playback.report = async (_session, report) => service.report(id, report, 100, 'direct');
        emby.oblecto.playback.stop = async () => service.end(id);
        upsertPlaybackEntry(emby, 'jellyfin-token', { playSessionId: 'managed', statisticsId: id, streamSessionId: 'lease' });
        await service.report(id, { position: 0, paused: false }, 100, 'direct');
        now += 10000;
        const response = await fetch(base + '/sessions/playing/progress', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-emby-token': 'jellyfin-token' },
            body: JSON.stringify({ ItemId: formatId(movie.id, 'movie'), PlaySessionId: 'managed', PositionTicks: 100000000 })
        });
        assert.equal(response.status, 204);
        assert.equal(await ViewingSession.count(), 1);
        assert.equal((await ViewingSession.findByPk(id))!.getDataValue('watchSeconds'), 10);
    });
    it('does not create viewing history for serving federation peers', async () => {
        await service.begin('peer', null, null, 'peer');
        await service.report('peer', { position: 10 }, 100, 'direct');
        assert.equal(await ViewingSession.count(), 0);
    });
    it('recovers interrupted sessions without crediting offline time', async () => {
        await begin();
        now += 20000;
        await report();
        now += 1000000;
        const restarted = new StatisticsService(database, undefined, () => now);
        await restarted.settled();
        const row = (await ViewingSession.findByPk('session'))!;
        assert.equal(row.getDataValue('endReason'), 'interrupted');
        assert.equal(row.getDataValue('watchSeconds'), 20);
        await restarted.close();
    });
    it('isolates personal queries, guards all admin endpoints and supports stable pagination', async () => {
        await begin();
        now += 20000;
        await report();
        await begin('other', other);
        await begin('second');
        const personal = await get(`/api/v1/statistics/me/history?from=${period.from}&to=${period.to}&userId=${other.id}&limit=1`, owner);
        assert.equal(personal.status, 200);
        assert.equal(personal.body.items[0].userId, owner.id);
        assert.equal(personal.body.items[0].checkpoint, undefined);
        assert.ok(personal.body.nextCursor);
        const second = await get(`/api/v1/statistics/me/history?from=${period.from}&to=${period.to}&cursor=${personal.body.nextCursor}`, owner);
        assert.equal(second.body.items.length, 1);
        assert.notEqual(second.body.items[0].id, personal.body.items[0].id);
        for (const endpoint of ['summary', 'history', 'library', 'health']) {
            assert.equal((await get(`/api/v1/statistics/server/${endpoint}`, owner)).status, 403);
            assert.equal((await get(`/api/v1/statistics/server/${endpoint}`, admin)).status, 200);
        }
        assert.equal((await get('/api/v1/statistics/me/summary')).status, 401);
        const all = await get('/api/v1/statistics/server/history?from=2026-10-01&to=2026-11-01', admin);
        assert.equal(all.body.items.length, 3);
        const filtered = await get(`/api/v1/statistics/server/history?from=2026-10-01&to=2026-11-01&userId=${other.id}`, admin);
        assert.equal(filtered.body.items.length, 1);
    });
    it('cascades deleted users and daily details without retaining identifiable history', async () => {
        await begin();
        now += 20000;
        await report();
        await owner.destroy();
        assert.equal(await ViewingSession.count(), 0);
        assert.equal(await ViewingDay.count(), 0);
    });
    it('separates local bytes, remote files and missing metadata in library totals', async () => {
        await File.bulkCreate([
            { host: 'local', size: 100 }, { host: '', size: 200 },
            { host: 'peer', size: 1000 }, { host: null, size: null, problematic: true }
        ] as never);
        const library = await queries.library();
        assert.equal(library.files, 4);
        assert.equal(library.localBytes, 300);
        assert.equal(library.remoteFiles, 1);
        assert.equal(library.missingSize, 1);
        assert.equal(library.problematicFiles, 1);
    });
    it('distinguishes failed attempts and unavailable buffering telemetry', async () => {
        await begin('failed');
        await service.failure('failed', 'ENCODING_FAILED');
        await service.end('failed', 'failed');
        const health = await queries.health(period) as any;
        assert.equal(health.failures.failedAttempts, 1);
        assert.equal(health.failures.failedSessions, 1);
        assert.equal(health.failures.bufferingKnownSessions, 0);
        assert.equal(health.failures.bufferingReports, null);
    });
    it('samples operational means and peaks transactionally, preserving hourly history after pruning', async () => {
        const gauges = { viewers: 1, sessions: 2, direct: 2, remux: 0, transcode: 0, encoders: 0, queue: 0, cacheBytes: 100 };
        now = Date.parse('2026-10-06T12:00:00Z');
        await service.sample(gauges);
        now += 15000;
        await service.sample({ ...gauges, viewers: 3, cacheBytes: 200 });
        const rows = await PlaybackHealth.findAll({ where: { resolution: 'minute' } });
        const data = JSON.parse(rows[0].getDataValue('data'));
        assert.equal(data.samples, 2);
        assert.equal(data.sums.viewers / data.samples, 2);
        assert.equal(data.peaks.viewers, 3);
        now += 31 * 86400000;
        await service.sample(gauges);
        assert.equal(await PlaybackHealth.count({ where: { resolution: 'minute' } }), 1);
        assert.equal(await PlaybackHealth.count({ where: { resolution: 'hour' } }), 2);
    });
    it('keeps streaming callers successful when statistics writes fail', async () => {
        await begin();
        await database.getQueryInterface().dropTable('ViewingDays');
        now += 20000;
        await assert.doesNotReject(report());
        assert.equal(service.degraded, true);
        const row = (await ViewingSession.findByPk('session'))!;
        assert.equal(row.getDataValue('watchSeconds'), 0);
    });
});
