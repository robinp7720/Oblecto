/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import seriesRoutes from '../../src/submodules/REST/routes/tvshows.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { File, fileColumns } from '../../src/models/file.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';

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

describe('Series browse list route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });

        Episode.belongsTo(Series);
        Series.hasMany(Episode);

        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });

        Episode.belongsToMany(File, { through: EpisodeFiles });
        File.belongsToMany(Episode, { through: EpisodeFiles });

        await sequelize.sync({ force: true });

        const seriesA = await Series.create({
            seriesName: 'Galaxy Patrol',
            genre: '["Sci-Fi"]',
            firstAired: '2020-01-01',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z')
        });

        const seriesB = await Series.create({
            seriesName: 'Cozy Town',
            genre: 'Drama',
            firstAired: '2019-01-01',
            createdAt: new Date('2024-01-02T00:00:00Z'),
            updatedAt: new Date('2024-01-02T00:00:00Z')
        });

        const seriesC = await Series.create({
            seriesName: 'Nature Lens',
            genre: 'Documentary',
            firstAired: '2018-01-01',
            createdAt: new Date('2024-01-03T00:00:00Z'),
            updatedAt: new Date('2024-01-03T00:00:00Z')
        });

        const episodeA = await Episode.create({
            episodeName: 'Galaxy Pilot',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            SeriesId: seriesA.id
        });

        const episodeB = await Episode.create({
            episodeName: 'Town Pilot',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            SeriesId: seriesB.id
        });

        const episodeC = await Episode.create({
            episodeName: 'Nature Pilot',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            SeriesId: seriesC.id
        });

        const fileA = await File.create({ path: '/tv/scifi/galaxy-pilot.mkv' });
        const fileB = await File.create({ path: '/tv/drama/town-pilot.mkv' });

        await EpisodeFiles.create({ EpisodeId: episodeA.id, FileId: fileA.id });
        await EpisodeFiles.create({ EpisodeId: episodeB.id, FileId: fileB.id });

        await TrackEpisode.create({ userId: 5, episodeId: episodeA.id, progress: 0.95 });
        await TrackEpisode.create({ userId: 5, episodeId: episodeB.id, progress: 0.45 });
        await TrackEpisode.create({ userId: 5, episodeId: episodeC.id, progress: 0 });
    });

    it('returns browse envelope with cursor pagination', async () => {
        const server = makeServer();
        const mockOblecto = {
            config: {
                assets: {
                    showPosterLocation: '/tmp',
                    storeWithFile: false
                }
            },
            artworkUtils: {
                seriesPosterPath: () => '/tmp/poster.jpg'
            }
        };
        seriesRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /series/list/:sorting');

        const firstRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: { mode: 'browse', order: 'asc', count: '2' },
            authorization: { user: { id: 5 } }
        }, firstRes);

        assert.equal(firstRes.statusCode, 200);
        assert.equal(firstRes.body.items.length, 2);
        assert.equal(firstRes.body.pageInfo.hasNextPage, true);
        assert.deepEqual(firstRes.body.facets.genres.sort(), ['Documentary', 'Drama', 'Sci-Fi']);
        assert.deepEqual(firstRes.body.facets.years, [2018, 2019, 2020]);

        const secondRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: {
                mode: 'browse',
                order: 'asc',
                count: '2',
                cursor: firstRes.body.pageInfo.nextCursor
            },
            authorization: { user: { id: 5 } }
        }, secondRes);

        assert.equal(secondRes.statusCode, 200);
        assert.equal(secondRes.body.items.length, 1);
    });

    it('supports watched and library filters in browse mode', async () => {
        const server = makeServer();
        const mockOblecto = {
            config: {
                assets: {
                    showPosterLocation: '/tmp',
                    storeWithFile: false
                }
            },
            artworkUtils: {
                seriesPosterPath: () => '/tmp/poster.jpg'
            }
        };
        seriesRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /series/list/:sorting');

        const watchedRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: { mode: 'browse', order: 'desc', watched: 'watched' },
            authorization: { user: { id: 5 } }
        }, watchedRes);

        assert.equal(watchedRes.statusCode, 200);
        assert.equal(watchedRes.body.items.length, 1);
        assert.equal(watchedRes.body.items[0].seriesName, 'Galaxy Patrol');

        const libraryRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: {
                mode: 'browse',
                order: 'desc',
                libraryPath: '/tv/drama'
            },
            authorization: { user: { id: 5 } }
        }, libraryRes);

        assert.equal(libraryRes.statusCode, 200);
        assert.equal(libraryRes.body.items.length, 1);
        assert.equal(libraryRes.body.items[0].seriesName, 'Cozy Town');
    });

    it('keeps legacy mode response as an array', async () => {
        const server = makeServer();
        const mockOblecto = {
            config: {
                assets: {
                    showPosterLocation: '/tmp',
                    storeWithFile: false
                }
            },
            artworkUtils: {
                seriesPosterPath: () => '/tmp/poster.jpg'
            }
        };
        seriesRoutes(server as any, mockOblecto as any);

        const handler = server.handlers.get('GET /series/list/:sorting');

        const res = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: { order: 'desc', count: '2', page: '0' },
            authorization: { user: { id: 5 } }
        }, res);

        assert.equal(res.statusCode, 200);
        assert.ok(Array.isArray(res.body));
        assert.equal(res.body.length, 2);
    });
});
