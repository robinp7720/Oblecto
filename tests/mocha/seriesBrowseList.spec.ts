import { User } from '../../src/models/user.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import config from '../../src/config.js';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import episodeRoutes from '../../src/submodules/REST/routes/episodes.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { UserFavourite, userFavouriteColumns } from '../../src/models/userFavourite.js';
import { UserSeriesWatchlist, userSeriesWatchlistColumns } from '../../src/models/userSeriesWatchlist.js';
import seriesRoutes from '../../src/submodules/REST/routes/tvshows.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { File, fileColumns } from '../../src/models/file.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';

const makeServer = () => {
    const handlers = new Map();
    const chains = new Map();

    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        chains.set(`${method} ${route}`, routeHandlers);
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
    };

    return {
        handlers, chains,
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
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        UserFavourite.init(userFavouriteColumns, { sequelize, modelName: 'UserFavourite' });
        UserSeriesWatchlist.init(userSeriesWatchlistColumns, { sequelize, modelName: 'UserSeriesWatchlist', indexes: [{ unique: true, fields: ['userId', 'seriesId'] }] });
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

    it('gates catalogue work on libraries.manage and returns compact diagnostics without user history or paths', async () => {
        const server = makeServer();
        let requests = 0;
        seriesRoutes(server as any, { seriesExtras: { getCatalog: async () => {
            requests++;
            return { catalog: { episodes: [] }, catalogUpdatedAt: null, unavailable: false };
        } } } as any);
        const [permission, handler] = server.chains.get('GET /series/:id/library');
        const original = User.findByPk;
        User.findByPk = (async () => ({ id: 5, password: null })) as any;
        try {
            const authorize = (permissions: string[] | null): Promise<any> => new Promise(resolve => permission({ params: { id: '1' },
                ...(permissions === null ? {} : { authorization: { credentials: issueAccessToken({ id: 5, password: null }, config.authentication), principal: { id: 5, permissions } } })
            }, makeRes(), resolve));
            assert.equal((await authorize(null)).statusCode, 401);
            assert.equal((await authorize([])).statusCode, 403);
            assert.equal(requests, 0);
            assert.equal(await authorize(['libraries.manage']), undefined);
            const res = makeRes();
            await handler({ params: { id: '1' } }, res);
            assert.equal(requests, 1);
            assert.equal(res.body.series.seriesName, 'Galaxy Patrol');
            assert.equal(res.body.rows[0].status, 'review');
            assert.deepEqual(Object.keys(res.body.rows[0].local.Files[0]), ['id']);
            assert.equal('TrackEpisodes' in res.body.rows[0].local, false);
            const missing = makeRes();
            await handler({ params: { id: '999' } }, missing);
            assert.equal(missing.statusCode, 404);
            assert.equal(requests, 1);
        } finally { User.findByPk = original; }
    });

    it('saves series and episodes independently and scopes saved series lists and facets to the viewer', async () => {
        const server = makeServer();
        seriesRoutes(server as any, {} as any);
        episodeRoutes(server as any, {} as any);
        const call = async (method: string, path: string, params: Record<string, string>, body: unknown, userId = 5) => {
            const res = makeRes();
            await server.handlers.get(`${method} ${path}`)({ params, body, authorization: { user: { id: userId } } }, res);
            return res;
        };
        const saved = await call('PUT', '/series/:id/watchlist', { id: '1' }, { watchlist: true });
        assert.equal(saved.statusCode, 200);
        await call('PUT', '/series/:id/watchlist', { id: '1' }, { watchlist: true });
        assert.equal(await UserSeriesWatchlist.count(), 1);
        await call('PUT', '/series/:id/watchlist', { id: '2' }, { watchlist: true }, 6);
        await call('PUT', '/series/:id/favourite', { id: '1' }, { favourite: true });
        await call('PUT', '/episode/:id/favourite', { id: '1' }, { favourite: true });
        await call('PUT', '/episode/:id/favourite', { id: '1' }, { favourite: false });
        assert.equal(await UserFavourite.count({ where: { userId: 5, itemType: 'series', itemId: 1 } }), 1);
        assert.equal(await UserFavourite.count({ where: { userId: 5, itemType: 'episode', itemId: 1 } }), 0);
        for (const list of ['watchlist', 'favourites']) {
            const res = makeRes();
            await server.handlers.get('GET /series/list/:sorting')({ params: { sorting: 'seriesName' }, combined_params: { mode: 'browse', list }, authorization: { user: { id: 5 } } }, res);
            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body.items.map((item: Series) => item.id), [1]);
            assert.deepEqual(res.body.facets.genres, ['Sci-Fi']);
            assert.equal(res.body.appliedFilters.list, list);
        }
        assert.equal((await call('PUT', '/series/:id/watchlist', { id: '1' }, { watchlist: 'yes' })).statusCode, 400);
        assert.equal((await call('PUT', '/episode/:id/favourite', { id: '1' }, { favourite: 1 })).statusCode, 400);
        assert.equal((await call('PUT', '/series/:id/watchlist', { id: '999' }, { watchlist: true })).statusCode, 404);
        await call('PUT', '/series/:id/watchlist', { id: '1' }, { watchlist: false });
        assert.equal(await UserSeriesWatchlist.count({ where: { userId: 6 } }), 1);
    });

    it('marks earlier episodes only within the requested series and calling account', async () => {
        const server = makeServer();
        seriesRoutes(server as any, {} as any);
        const anchor = await Episode.create({ SeriesId: 1, airedSeason: '2', airedEpisodeNumber: '1' });
        const special = await Episode.create({ SeriesId: 1, airedSeason: '0', airedEpisodeNumber: '1' });
        const handler = server.handlers.get('PUT /series/:id/episodes/:episodeId/earlier/watched');
        const request = { params: { id: '1', episodeId: String(anchor.id) }, body: { watched: true }, authorization: { user: { id: 7 } } };
        const res = makeRes();
        await handler(request, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.episodes.map((row: { id: number }) => row.id), [1]);
        assert.equal(Number((await TrackEpisode.findOne({ where: { userId: 7, episodeId: 1 } }))?.progress), 1);
        assert.equal(Number((await TrackEpisode.findOne({ where: { userId: 5, episodeId: 1 } }))?.progress), 0.95);
        assert.equal(await TrackEpisode.count({ where: { userId: 7, episodeId: special.id } }), 0);
        const wrongSeries = makeRes();
        await handler({ ...request, params: { id: '2', episodeId: String(anchor.id) } }, wrongSeries);
        assert.equal(wrongSeries.statusCode, 404);
        const badBody = makeRes();
        await handler({ ...request, body: { watched: false } }, badBody);
        assert.equal(badBody.statusCode, 400);
        await anchor.destroy();
        await special.destroy();
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
