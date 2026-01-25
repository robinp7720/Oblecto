
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import showsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/shows/index.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { formatUuid, formatId } from '../../src/lib/embyEmulation/helpers.js';

const makeServer = () => {
    const handlers = new Map();

    const register = (method: string) => (route: string, handler: any) => {
        handlers.set(`${method} ${route}`, handler);
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

describe('Emby shows routes', () => {
    let sequelize: Sequelize;
    let series1: Series;
    let ep1_1: Episode, ep1_2: Episode;
    const userId = 1;
    const userIdUuid = formatUuid(userId);

    before(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite', storage: ':memory:', logging: false 
        });

        // Initialize models
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });

        // Associations
        Episode.belongsTo(Series);
        Series.hasMany(Episode);
        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        
        Episode.hasMany(File);
        File.belongsTo(Episode);
        File.hasMany(Stream);
        Stream.belongsTo(File);

        await sequelize.sync({ force: true });

        // Seed data
        series1 = await Series.create({ seriesName: 'Test Series', firstAired: '2021-01-01' });

        ep1_1 = await Episode.create({
            episodeName: 'S1E1',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            SeriesId: series1.id
        });
        
        ep1_2 = await Episode.create({
            episodeName: 'S1E2',
            airedSeason: 1,
            airedEpisodeNumber: 2,
            SeriesId: series1.id
        });

        await File.create({ path: '/tmp/s1e1.mkv', EpisodeId: ep1_1.id });
        await File.create({ path: '/tmp/s1e2.mkv', EpisodeId: ep1_2.id });

        // User watched S1E1 fully
        await TrackEpisode.create({
            userId,
            episodeId: ep1_1.id,
            progress: 1,
            updatedAt: new Date()
        });
    });

    describe('GET /shows/nextup', () => {
        it('should return empty list if no userId provided', async () => {
            const server = makeServer();
            showsRoutes(server as any, {} as any);

            const handler = server.handlers.get('GET /shows/nextup');
            const req = { query: {} };
            const res = makeRes();

            await handler(req, res);

            assert.deepEqual(res.body.Items, []);
            assert.equal(res.body.TotalRecordCount, 0);
        });
        
        it('should resume episode if progress < 1', async () => {
            // Add partially watched episode
            await TrackEpisode.create({
                userId,
                episodeId: ep1_2.id,
                progress: 0.5,
                updatedAt: new Date()
            });

            const server = makeServer();
            showsRoutes(server as any, { serverId: 'test' } as any);

            const handler = server.handlers.get('GET /shows/nextup');
            const req = { query: { userId: userIdUuid } };
            const res = makeRes();

            await handler(req, res);

            // Cleanup
            await TrackEpisode.destroy({ where: { episodeId: ep1_2.id } });

            const items = res.body.Items;
            // Should contain S1E2 (resuming)
            const s1e2 = items.find((i: any) => i.Name === 'S1E2');
            assert.ok(s1e2, 'Should have S1E2 as next up (resume)');
        });
    });

    describe('GET /shows/:seriesid/seasons', () => {
        it('should return seasons for a series', async () => {
            const server = makeServer();
            showsRoutes(server as any, { serverId: 'test' } as any);

            const handler = server.handlers.get('GET /shows/:seriesid/seasons');
            const req = { 
                params: { seriesid: formatId(series1.id, 'series') },
                query: {} 
            };
            const res = makeRes();

            await handler(req, res);

            assert.ok(res.body.Items);
            assert.equal(res.body.Items.length, 1);
            assert.equal(res.body.Items[0].SeriesName, 'Test Series');
            assert.equal(res.body.Items[0].Type, 'Season');
        });

        it('should return empty if series not found', async () => {
            const server = makeServer();
            showsRoutes(server as any, {} as any);

            const handler = server.handlers.get('GET /shows/:seriesid/seasons');
            const req = { 
                params: { seriesid: formatId(99999, 'series') },
                query: {} 
            };
            const res = makeRes();

            await handler(req, res);

            assert.deepEqual(res.body.Items, []);
        });
    });

    describe('GET /shows/:seriesid/episodes', () => {
        it('should return episodes for a series', async () => {
            const server = makeServer();
            showsRoutes(server as any, { serverId: 'test' } as any);

            const handler = server.handlers.get('GET /shows/:seriesid/episodes');
            const req = { 
                params: { seriesid: formatId(series1.id, 'series') },
                query: {} 
            };
            const res = makeRes();

            await handler(req, res);

            assert.ok(res.body.Items);
            assert.equal(res.body.Items.length, 2);
            assert.equal(res.body.Items[0].Name, 'S1E1');
        });

        it('should filter by season query param', async () => {
            const server = makeServer();
            showsRoutes(server as any, { serverId: 'test' } as any);

            const handler = server.handlers.get('GET /shows/:seriesid/episodes');
            const req = { 
                params: { seriesid: formatId(series1.id, 'series') },
                query: { season: '1' } 
            };
            const res = makeRes();

            await handler(req, res);

            assert.ok(res.body.Items);
            assert.equal(res.body.Items.length, 2); // Both are season 1
        });

        it('should filter by SeasonId query param', async () => {
            const server = makeServer();
            showsRoutes(server as any, { serverId: 'test' } as any);

            const handler = server.handlers.get('GET /shows/:seriesid/episodes');
            const seasonId = series1.id * 1000 + 1; // Pseudo-id logic
            const req = { 
                params: { seriesid: formatId(series1.id, 'series') },
                query: { SeasonId: formatId(seasonId, 'season') } 
            };
            const res = makeRes();

            await handler(req, res);

            assert.ok(res.body.Items);
            assert.equal(res.body.Items.length, 2);
        });

         it('should include user data if userId provided', async () => {
            const server = makeServer();
            showsRoutes(server as any, { serverId: 'test' } as any);

            const handler = server.handlers.get('GET /shows/:seriesid/episodes');
            const req = { 
                params: { seriesid: formatId(series1.id, 'series') },
                query: { userId: userIdUuid } 
            };
            const res = makeRes();

            await handler(req, res);

            assert.ok(res.body.Items);
            const ep1 = res.body.Items.find((i: any) => i.Name === 'S1E1');
            // Assuming formatMediaItem puts user data in UserData
            assert.ok(ep1.UserData, 'UserData should be present');
            assert.equal(ep1.UserData.Played, true);
        });
    });
});
