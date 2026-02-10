/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import moviesRoutes from '../../src/submodules/REST/routes/movies.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { User, userColumns } from '../../src/models/user.js';
import { File, fileColumns } from '../../src/models/file.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';

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

describe('Movies browse list route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        User.init(userColumns, { sequelize, modelName: 'User' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });

        TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });
        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });

        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });

        await sequelize.sync({ force: true });

        await User.create({ id: 1, name: 'tester', password: 'x' });

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
