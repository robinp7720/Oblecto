
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import usersRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/users/index.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { User, userColumns } from '../../src/models/user.js';
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

describe('Emby users routes', () => {
    let sequelize: Sequelize;
    let series1: Series;
    let ep1_1: Episode;
    let movie1: Movie;
    let user1: User;
    const userId = 1;
    const userIdUuid = formatUuid(userId);

    const mockEmbyEmulation: any = {
        serverId: 'test-server-id',
        sessions: {}
    };

    before(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite', storage: ':memory:', logging: false 
        });

        // Initialize models
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        User.init(userColumns, { sequelize, modelName: 'User' });

        // Associations
        Episode.belongsTo(Series);
        Series.hasMany(Episode);
        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });
        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });
        
        Episode.hasMany(File);
        File.belongsTo(Episode);
        Movie.hasMany(File);
        File.belongsTo(Movie);

        File.hasMany(Stream);
        Stream.belongsTo(File);

        await sequelize.sync({ force: true });

        // Seed data
        user1 = await User.create({ name: 'Test User', password: '' });
        // Hardcode ID 1 if possible or use created ID
        if (user1.id !== 1) {
             // Forcing ID 1 because some logic might rely on specific IDs or just consistency in tests
             // But emby routes parse UUIDs.
        }

        series1 = await Series.create({ seriesName: 'Test Series', firstAired: '2021-01-01' });

        ep1_1 = await Episode.create({
            episodeName: 'S1E1',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            SeriesId: series1.id
        });

        movie1 = await Movie.create({
             movieName: 'Test Movie',
             releaseDate: '2020-01-01'
        });

        await File.create({ path: '/tmp/s1e1.mkv', EpisodeId: ep1_1.id });
        await File.create({ path: '/tmp/movie.mkv', MovieId: movie1.id });
    });

    describe('GET /users', () => {
        it('should return list of users', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users');
            const req = { };
            const res = makeRes();

            await handler(req, res);

            assert.ok(Array.isArray(res.body));
            assert.equal(res.body.length, 1);
            assert.equal(res.body[0].Name, 'Test User');
        });
    });

    describe('GET /users/:userid/items', () => {
        it('should return movies when IncludeItemTypes=Movie', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items');
            const req = { 
                query: { IncludeItemTypes: 'Movie' },
                params: { userid: userIdUuid }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.TotalRecordCount, 1);
            assert.equal(res.body.Items[0].Name, 'Test Movie');
            assert.equal(res.body.Items[0].Type, 'Movie');
        });

        it('should return series when IncludeItemTypes=Series', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items');
            const req = { 
                query: { IncludeItemTypes: 'Series' },
                params: { userid: userIdUuid }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.TotalRecordCount, 1);
            assert.equal(res.body.Items[0].Name, 'Test Series');
            assert.equal(res.body.Items[0].Type, 'Series');
        });

        it('should return episodes when IncludeItemTypes=Episode', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items');
            const req = { 
                query: { IncludeItemTypes: 'Episode' },
                params: { userid: userIdUuid }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.TotalRecordCount, 1);
            assert.equal(res.body.Items[0].Name, 'S1E1');
            assert.equal(res.body.Items[0].Type, 'Episode');
        });

        it('should filter movies by SearchTerm', async () => {
             const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items');
            const req = { 
                query: { IncludeItemTypes: 'Movie', SearchTerm: 'NonExistent' },
                params: { userid: userIdUuid }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.Items.length, 0);
        });
    });

    describe('GET /users/:userid/items/:mediaid', () => {
        it('should return movie by id', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items/:mediaid');
            const req = { 
                params: { userid: userIdUuid, mediaid: formatId(movie1.id, 'movie') }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.Name, 'Test Movie');
            assert.equal(res.body.Type, 'Movie');
        });

        it('should return episode by id', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items/:mediaid');
            const req = { 
                params: { userid: userIdUuid, mediaid: formatId(ep1_1.id, 'episode') }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.Name, 'S1E1');
            assert.equal(res.body.Type, 'Episode');
        });
        
        it('should return 404 for unknown item', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /users/:userid/items/:mediaid');
            const req = { 
                params: { userid: userIdUuid, mediaid: formatId(99999, 'movie') }
            };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.statusCode, 404);
        });
    });
    
    describe('GET /items/latest', () => {
         it('should return latest movies', async () => {
            const server = makeServer();
            usersRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /items/latest');
            const req = { 
                query: { ParentId: 'movies' },
                headers: { emby: { Token: 'test-token' } }
            };
            const res = makeRes();
            
            // Mock session for userId retrieval if needed
            mockEmbyEmulation.sessions['test-token'] = { Id: userIdUuid };

            await handler(req, res);

            assert.ok(Array.isArray(res.body));
            assert.equal(res.body[0].Name, 'Test Movie');
         });
    });
});
