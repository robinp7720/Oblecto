/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import episodeRoutes from '../../src/submodules/REST/routes/episodes.js';
import { pickNextEpisodes } from '../../src/submodules/REST/routes/helpers/nextEpisodes.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { makeServer as makeRouteServer, makeRes as makeRouteRes } from '../helpers/routes.js';

const makeServer = () => {
    const handlers = new Map();

    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
    };

    return {
        handlers,
        get: register('GET'),
        post: register('POST'),
        put: register('PUT'),
        delete: register('DELETE')
    };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) {
        this.statusCode = code;
        return this;
    },
    send(payload: any) {
        this.body = payload;
        return this;
    }
});

describe('Next episodes', () => {
    describe('GET /episode/:id/next on SQLite', () => {
        let sequelize: Sequelize;
        let handler: (request: object, response: object) => Promise<void>;
        const ids: Record<string, number> = {};

        before(async () => {
            sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
            Series.init(seriesColumns, { sequelize, modelName: 'Series' });
            Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
            await sequelize.sync({ force: true });

            const series = await Series.create({ seriesName: 'Numeric order' });
            const other = await Series.create({ seriesName: 'Other series' });
            await Episode.create({ SeriesId: other.id, airedSeason: '1', airedEpisodeNumber: '3' });
            // Insert out of order so neither row IDs nor text sorting give the right sequence.
            for (const [season, episode] of [
                ['10', '1'], ['1', '10'], ['2', '1'], ['1', '1'], ['1', '9'],
                ['1', '2'], ['1', '11'], ['9', '1'], ['11', '1'], ['01', '04']
            ]) {
                ids[`${season}:${episode}`] = (await Episode.create({
                    SeriesId: series.id, airedSeason: season, airedEpisodeNumber: episode
                })).id;
            }
            const server = makeRouteServer();
            episodeRoutes(server, {} as Parameters<typeof episodeRoutes>[1]);
            handler = server.handlers.get('GET /episode/:id/next');
        });

        after(async () => { await sequelize.close(); });

        for (const [current, next] of [
            ['1:1', '1:2'], ['1:2', '01:04'], ['01:04', '1:9'],
            ['1:9', '1:10'], ['1:10', '1:11'], ['1:11', '2:1'],
            ['2:1', '9:1'], ['9:1', '10:1'], ['10:1', '11:1']
        ]) {
            it(`plays ${next} after ${current} in the same series`, async () => {
                const res = makeRouteRes<Episode | null>();
                await handler({ params: { id: String(ids[current]) } }, res);
                assert.equal(res.statusCode, 200);
                assert.equal(res.body?.id, ids[next]);
            });
        }

        it('returns no next episode at the end of the series', async () => {
            const res = makeRouteRes<Episode | null>();
            await handler({ params: { id: String(ids['11:1']) } }, res);
            assert.equal(res.body, null);
        });

        it('returns 404 for an unknown episode', async () => {
            const res = makeRouteRes<{ message: string }>();
            await handler({ params: { id: '999999' } }, res);
            assert.equal(res.statusCode, 404);
            assert.deepEqual(res.body, { message: 'Episode not found' });
        });
    });

    describe('pickNextEpisodes', () => {
        const episode = (id: number, SeriesId: number, airedSeason: string, airedEpisodeNumber: string) => ({ id, SeriesId, airedSeason, airedEpisodeNumber });

        it('follows the furthest watched episode in numeric order, across seasons', () => {
            const episodes = [episode(1, 1, '1', '9'), episode(2, 1, '1', '10'), episode(3, 1, '1', '100'), episode(4, 1, '2', '1'), episode(5, 1, '10', '1')];

            assert.deepEqual(pickNextEpisodes([episodes[0]], episodes), [2]);
            assert.deepEqual(pickNextEpisodes([episodes[1], episodes[0]], episodes), [3]);
            assert.deepEqual(pickNextEpisodes([episodes[2]], episodes), [4]);
            assert.deepEqual(pickNextEpisodes([episodes[3]], episodes), [5]);
            assert.deepEqual(pickNextEpisodes([episodes[4]], episodes), []);
        });

        it('orders series by when they were last watched', () => {
            const episodes = [episode(1, 1, '1', '1'), episode(2, 1, '1', '2'), episode(3, 2, '1', '1'), episode(4, 2, '1', '2')];

            assert.deepEqual(pickNextEpisodes([episodes[2], episodes[0]], episodes), [4, 2]);
        });
    });

    describe('GET /episodes/next on SQLite', () => {
        let sequelize: Sequelize;
        let handler: any;
        const ids: Record<string, number> = {};

        before(async () => {
            sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

            Series.init(seriesColumns, { sequelize, modelName: 'Series' });
            Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
            TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });

            Episode.belongsTo(Series);
            Series.hasMany(Episode);
            TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
            Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });

            await sequelize.sync({ force: true });

            const drama = await Series.create({ seriesName: 'Drama' });
            const comedy = await Series.create({ seriesName: 'Comedy' });
            const finished = await Series.create({ seriesName: 'Finished' });

            for (const [key, SeriesId, airedSeason, airedEpisodeNumber] of [
                ['drama9', drama.id, '1', '9'], ['drama10', drama.id, '1', '10'], ['drama11', drama.id, '1', '11'],
                ['comedy1', comedy.id, '1', '1'], ['comedy2', comedy.id, '2', '1'],
                ['finished1', finished.id, '1', '1']
            ] as const) {
                ids[key] = (await Episode.create({ episodeName: key, SeriesId, airedSeason, airedEpisodeNumber })).id;
            }

            // Preserve the fixture timestamp: save() otherwise overwrites it with now,
            // leaving the series ordering dependent on whether writes share a millisecond.
            await TrackEpisode.create({ userId: 1, episodeId: ids.comedy1, progress: 1, updatedAt: new Date(Date.now() - 60_000) }, { silent: true });
            await TrackEpisode.create({ userId: 1, episodeId: ids.drama10, progress: 1 });
            await TrackEpisode.create({ userId: 1, episodeId: ids.drama9, progress: 1 });
            await TrackEpisode.create({ userId: 1, episodeId: ids.drama11, progress: 0.3 });
            await TrackEpisode.create({ userId: 1, episodeId: ids.finished1, progress: 1 });
            // Another user's progress counts for nothing
            await TrackEpisode.create({ userId: 2, episodeId: ids.comedy2, progress: 1 });

            const server = makeServer();
            episodeRoutes(server as any, { config: { database: { dialect: 'sqlite' } } } as any);
            handler = server.handlers.get('GET /episodes/next');
        });

        after(async () => {
            await sequelize.close();
        });

        it('returns the next episode of each series, most recently watched first', async () => {
            const res = makeRes();
            await handler({ authorization: { user: { id: 1 } } }, res);

            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body.map((episode: any) => episode.id), [ids.drama11, ids.comedy2]);
            assert.equal(res.body[0].Series.seriesName, 'Drama');
            assert.equal(res.body[0].TrackEpisodes[0].progress, 0.3);
            assert.deepEqual(res.body[1].TrackEpisodes, []);
        });

        it('returns an empty list without watch history', async () => {
            const res = makeRes();
            await handler({ authorization: { user: { id: 3 } } }, res);

            assert.deepEqual(res.body, []);
        });
    });
});
