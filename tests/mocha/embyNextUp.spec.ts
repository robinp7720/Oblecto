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

    const register = (method) => (route, handler) => {
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
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    send(payload) {
        this.body = payload;
        return this;
    }
});

describe('Emby shows nextup route', () => {
    let sequelize;
    let series1, series2;
    let ep1_1, ep1_2, ep2_1, ep2_2;
    const userId = 1;
    const userIdUuid = formatUuid(userId);

    before(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite', storage: ':memory:', logging: false 
        });

        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });

        Episode.belongsTo(Series);
        Series.hasMany(Episode);
        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        
        Episode.hasMany(File); // Simplified for test
        File.belongsTo(Episode); // Simplified
        File.hasMany(Stream);
        Stream.belongsTo(File);

        await sequelize.sync({ force: true });

        series1 = await Series.create({ seriesName: 'Series One', firstAired: '2021-01-01' });
        series2 = await Series.create({ seriesName: 'Series Two', firstAired: '2021-01-01' });

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

        ep2_1 = await Episode.create({
            episodeName: 'S2E1',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            SeriesId: series2.id
        });
        ep2_2 = await Episode.create({
            episodeName: 'S2E2',
            airedSeason: 1,
            airedEpisodeNumber: 2,
            SeriesId: series2.id
        });

        // User watched S1E1 and S2E1 fully
        await TrackEpisode.create({
            userId,
            EpisodeId: ep1_1.id, // Sequelize default FK naming if not specified, usually CamelCase + Id, but let's check. 
            // In model def: declare episodeId: ForeignKey<number>; and init uses trackEpisodesColumns with episodeId.
            episodeId: ep1_1.id,
            progress: 1,
            updatedAt: new Date(Date.now() - 10000)
        });

        await TrackEpisode.create({
            userId,
            episodeId: ep2_1.id,
            progress: 1,
            updatedAt: new Date(Date.now()) // Most recent
        });
    });

    it('returns next up episodes for all series if no SeriesId provided', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        showsRoutes(server, embyEmulation);

        const handler = server.handlers.get('GET /shows/nextup');
        const req = {
            query: {
                userId: userIdUuid
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.Items.length, 2);
        
        const names = res.body.Items.map(i => i.Name).sort();
        // Expecting S1E2 and S2E2 to be next up
        assert.deepStrictEqual(names, ['S1E2', 'S2E2']);
    });

    it('filters next up episodes by SeriesId if provided', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        showsRoutes(server, embyEmulation);

        const handler = server.handlers.get('GET /shows/nextup');
        
        // Emby style ID for series 1
        const series1EmbyId = formatId(series1.id, 'series');

        const req = {
            query: {
                userId: userIdUuid,
                SeriesId: series1EmbyId
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.Items.length, 1);
        assert.strictEqual(res.body.Items[0].Name, 'S1E2');
    });
});
