/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import moviesRoutes from '../../src/submodules/REST/routes/movies.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { User, userColumns } from '../../src/models/user.js';
import { File, fileColumns } from '../../src/models/file.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { UserFavourite, userFavouriteColumns } from '../../src/models/userFavourite.js';
import { UserWatchlist, userWatchlistColumns } from '../../src/models/userWatchlist.js';
import { setFavourite } from '../../src/lib/users/favourites.js';
import auth from '../../src/submodules/REST/middleware/auth.js';

const makeServer = () => {
    const handlers = new Map();
    const middleware = new Map();

    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
        middleware.set(`${method} ${route}`, routeHandlers.slice(0, -1));
    };

    return {
        handlers,
        middleware,
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

describe('Movies browse list route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        User.init(userColumns, { sequelize, modelName: 'User' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        UserFavourite.init(userFavouriteColumns, { sequelize, modelName: 'UserFavourite', indexes: [{ unique: true, fields: ['userId', 'itemType', 'itemId'] }] });
        UserWatchlist.init(userWatchlistColumns, { sequelize, modelName: 'UserWatchlist', indexes: [{ unique: true, fields: ['userId', 'movieId'] }] });

        TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });
        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });

        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });
        if (!File.associations.Streams) File.hasMany(Stream);
        if (!Stream.associations.File) Stream.belongsTo(File);

        await sequelize.sync({ force: true });

        await User.create({ id: 1, name: 'tester', password: 'x' });
        await User.create({ id: 2, name: 'other viewer', password: 'x' });

        const movieA = await Movie.create({
            movieName: 'Action Hero',
            releaseDate: '2020-01-01',
            genres: '["Action","Adventure"]',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z')
        });

        const movieB = await Movie.create({
            movieName: 'Quiet Drama',
            releaseDate: '2019-01-01',
            genres: 'Drama',
            createdAt: new Date('2024-01-02T00:00:00Z'),
            updatedAt: new Date('2024-01-02T00:00:00Z')
        });

        const movieC = await Movie.create({
            movieName: 'Space Documentary',
            releaseDate: '2018-01-01',
            genres: 'Documentary',
            createdAt: new Date('2024-01-03T00:00:00Z'),
            updatedAt: new Date('2024-01-03T00:00:00Z')
        });

        const fileA = await File.create({ path: '/media/movies/action-hero.mkv' });
        const fileB = await File.create({ path: '/media/archive/drama.mkv' });

        await MovieFiles.create({ MovieId: movieA.id, FileId: fileA.id });
        await MovieFiles.create({ MovieId: movieB.id, FileId: fileB.id });

        await TrackMovie.create({ userId: 1, movieId: movieA.id, progress: 0.95 });
        await TrackMovie.create({ userId: 1, movieId: movieB.id, progress: 0.45 });
        await TrackMovie.create({ userId: 1, movieId: movieC.id, progress: 0 });
    });

    after(async () => { await sequelize.close(); });

    it('authenticates all saved-movie and extras endpoints', () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);
        for (const route of ['GET /movie/:id/info', 'GET /movie/:id/extras', 'PUT /movie/:id/favourite', 'PUT /movie/:id/watchlist']) {
            assert.ok(server.middleware.get(route).includes(auth.requiresAuth));
        }
    });

    it('saves favourites and watchlists idempotently, validates writes and never uses a supplied user ID', async () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);
        for (const [field, model] of [['favourite', UserFavourite], ['watchlist', UserWatchlist]] as const) {
            const handler = server.handlers.get(`PUT /movie/:id/${field}`);
            const req = { params: { id: '1' }, authorization: { user: { id: 1 } }, body: { [field]: true, userId: 2 } };
            const first = makeRes();
            await handler(req, first);
            assert.equal(first.statusCode, 200);
            await handler(req, makeRes());
            assert.equal(await model.count({ where: { userId: 1 } }), 1);
            assert.equal(await model.count({ where: { userId: 2 } }), 0);
            const invalid = makeRes();
            await handler({ ...req, body: { [field]: 'false' } }, invalid);
            assert.equal(invalid.statusCode, 400);
            const missing = makeRes();
            await handler({ ...req, params: { id: '9999' } }, missing);
            assert.equal(missing.statusCode, 404);
            const remove = makeRes();
            await handler({ ...req, body: { [field]: false } }, remove);
            assert.equal(await model.count({ where: { userId: 1 } }), 0);
        }
    });

    it('returns private movie state and shares favourites with the existing Jellyfin service', async () => {
        await setFavourite(1, 'movie', 1, true);
        await UserWatchlist.create({ userId: 1, movieId: 1 });
        const server = makeServer();
        moviesRoutes(server as any, {} as any);
        const handler = server.handlers.get('GET /movie/:id/info');
        for (const userId of [1, 2]) {
            const res = makeRes();
            await handler({ params: { id: '1' }, authorization: { user: { id: userId } } }, res);
            assert.equal(res.statusCode, 200);
            assert.deepEqual(res.body.userState, { favourite: userId === 1, watchlist: userId === 1 });
        }
    });

    it('filters saved lists, facets and cursors by the signed-in user', async () => {
        await setFavourite(1, 'movie', 2, true);
        await setFavourite(2, 'movie', 3, true);
        const server = makeServer();
        moviesRoutes(server as any, {} as any);
        const handler = server.handlers.get('GET /movies/list/:sorting');
        const base = { params: { sorting: 'movieName' }, authorization: { user: { id: 1 } } };
        const query = { mode: 'browse', list: 'favourites', order: 'asc', count: '1' };
        const first = makeRes();
        await handler({ ...base, combined_params: query }, first);
        assert.equal(first.body.items[0].movieName, 'Action Hero');
        assert.deepEqual(first.body.facets.genres.sort(), ['Action', 'Adventure', 'Drama']);
        const second = makeRes();
        await handler({ ...base, combined_params: { ...query, cursor: first.body.pageInfo.nextCursor } }, second);
        assert.equal(second.body.items[0].movieName, 'Quiet Drama');
        const changed = makeRes();
        await handler({ ...base, combined_params: { ...query, list: 'watchlist', cursor: first.body.pageInfo.nextCursor } }, changed);
        assert.equal(changed.statusCode, 400);
        const watchlist = makeRes();
        await handler({ ...base, combined_params: { ...query, list: 'watchlist' } }, watchlist);
        assert.deepEqual(watchlist.body.items.map((item: Movie) => item.id), [1]);
        const other = makeRes();
        await handler({ ...base, authorization: { user: { id: 2 } }, combined_params: { ...query, list: 'watchlist', userId: '1' } }, other);
        assert.deepEqual(other.body.items, []);
        const invalid = makeRes();
        await handler({ ...base, combined_params: { ...query, list: 'everything' } }, invalid);
        assert.equal(invalid.statusCode, 400);
    });

    it('keeps legacy mode response as an array', async () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);

        const handler = server.handlers.get('GET /movies/list/:sorting');
        const req = {
            params: { sorting: 'createdAt' },
            combined_params: { order: 'desc', count: '2', page: '0' },
            authorization: { user: { id: 1 } }
        };
        const res = makeRes();

        await handler(req, res);

        assert.equal(res.statusCode, 200);
        assert.ok(Array.isArray(res.body));
        assert.equal(res.body.length, 2);
    });

    it('returns browse envelope and supports cursor pagination', async () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);

        const handler = server.handlers.get('GET /movies/list/:sorting');
        const baseReq = {
            params: { sorting: 'createdAt' },
            authorization: { user: { id: 1 } }
        };

        const firstRes = makeRes();
        await handler({
            ...baseReq,
            combined_params: { mode: 'browse', order: 'asc', count: '2' }
        }, firstRes);

        assert.equal(firstRes.statusCode, 200);
        assert.ok(Array.isArray(firstRes.body.items));
        assert.equal(firstRes.body.items.length, 2);
        assert.equal(firstRes.body.pageInfo.hasNextPage, true);
        assert.ok(typeof firstRes.body.pageInfo.nextCursor === 'string');
        assert.deepEqual(firstRes.body.facets.genres.sort(), ['Action', 'Adventure', 'Documentary', 'Drama']);
        assert.deepEqual(firstRes.body.facets.years, [2018, 2019, 2020]);

        const secondRes = makeRes();
        await handler({
            ...baseReq,
            combined_params: {
                mode: 'browse',
                order: 'asc',
                count: '2',
                cursor: firstRes.body.pageInfo.nextCursor
            }
        }, secondRes);

        assert.equal(secondRes.statusCode, 200);
        assert.equal(secondRes.body.items.length, 1);

        const firstIds = new Set(firstRes.body.items.map((item: any) => item.id));
        assert.equal(firstIds.has(secondRes.body.items[0].id), false);
    });

    it('supports watched and library filters in browse mode', async () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);

        const handler = server.handlers.get('GET /movies/list/:sorting');

        const watchedRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: { mode: 'browse', order: 'desc', watched: 'watched' },
            authorization: { user: { id: 1 } }
        }, watchedRes);

        assert.equal(watchedRes.statusCode, 200);
        assert.equal(watchedRes.body.items.length, 1);
        assert.equal(watchedRes.body.items[0].movieName, 'Action Hero');

        const libraryRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: {
                mode: 'browse',
                order: 'desc',
                libraryPath: '/media/movies'
            },
            authorization: { user: { id: 1 } }
        }, libraryRes);

        assert.equal(libraryRes.statusCode, 200);
        assert.equal(libraryRes.body.items.length, 1);
        assert.equal(libraryRes.body.items[0].movieName, 'Action Hero');
    });

    it('rejects cursor when the query context changes', async () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);

        const handler = server.handlers.get('GET /movies/list/:sorting');

        const firstRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: { mode: 'browse', order: 'asc', count: '1' },
            authorization: { user: { id: 1 } }
        }, firstRes);

        const invalidRes = makeRes();
        await handler({
            params: { sorting: 'createdAt' },
            combined_params: {
                mode: 'browse',
                order: 'asc',
                count: '1',
                watched: 'watched',
                cursor: firstRes.body.pageInfo.nextCursor
            },
            authorization: { user: { id: 1 } }
        }, invalidRes);

        assert.equal(invalidRes.statusCode, 400);
        assert.match(String(invalidRes.body.message), /cursor/i);
    });
});
