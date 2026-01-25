
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import itemsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/items/index.js';
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

describe('Emby items routes', () => {
    let sequelize: Sequelize;
    let series1: Series;
    let ep1_1: Episode;
    let movie1: Movie;
    let file1: File;
    const userId = 1;
    const userIdUuid = formatUuid(userId);

    const mockArtworkUtils = {
        moviePosterPath: () => '/tmp/poster.jpg',
        movieFanartPath: () => '/tmp/fanart.jpg',
        seriesPosterPath: () => '/tmp/series.jpg',
        episodeBannerPath: () => '/tmp/episode.jpg'
    };

    const mockEmbyEmulation: any = {
        serverId: 'test-server-id',
        sessions: {},
        oblecto: {
            artworkUtils: mockArtworkUtils,
            config: {
                artwork: {
                    poster: {},
                    fanart: {},
                    banner: {}
                }
            }
        }
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

        file1 = await File.create({ path: '/tmp/movie.mkv', MovieId: movie1.id });
    });

    describe('GET /items', () => {
        it('should return all items', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /items');
            const req = { query: { IncludeItemTypes: 'Movie,Series,Episode' } };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.TotalRecordCount, 3); // 1 movie, 1 series, 1 episode
        });

        it('should filter by SearchTerm', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /items');
            const req = { query: { IncludeItemTypes: 'Movie', SearchTerm: 'Test Movie' } };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.TotalRecordCount, 1);
            assert.equal(res.body.Items[0].Name, 'Test Movie');
        });
    });

    describe('GET /items/:mediaid', () => {
        it('should return movie details', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /items/:mediaid');
            const req = { params: { mediaid: formatId(movie1.id, 'movie') } };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.Name, 'Test Movie');
        });

        it('should return "shows" folder info', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /items/:mediaid');
            const req = { params: { mediaid: 'shows' } };
            const res = makeRes();

            await handler(req, res);

            assert.equal(res.body.Name, 'Shows');
        });
    });

    describe('GET /search/hints', () => {
        it('should return hints matching search term', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('GET /search/hints');
            const req = { query: { SearchTerm: 'Test' } }; // Matches 'Test Series' and 'Test Movie'
            const res = makeRes();

            await handler(req, res);

            assert.ok(res.body.TotalRecordCount >= 2);
            assert.ok(res.body.SearchHints.some((h: any) => h.Name === 'Test Movie'));
        });
    });

    describe('POST /items/:mediaid/playbackinfo', () => {
        it('should return playback info for movie', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const handler = server.handlers.get('POST /items/:mediaid/playbackinfo');
            const req = { 
                params: { mediaid: formatId(movie1.id, 'movie') },
                headers: { emby: { Token: 'test-token' } },
                query: {}
            };
            const res = makeRes();
            
            // Mock session for token
            mockEmbyEmulation.sessions['test-token'] = { Id: userIdUuid };

            await handler(req, res);

            assert.ok(res.body.MediaSources);
            assert.equal(res.body.MediaSources.length, 1);
        });
    });

    describe('Additional stub routes', () => {
        it('should return empty lists or defaults for stub routes', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const routes = [
                'GET /items/filters',
                'GET /items/filters2',
                'GET /items/:itemid/images',
                'GET /items/:itemid/instantmix',
                'GET /items/:itemid/externalidinfos',
                'GET /items/:itemid/criticreviews',
                'GET /items/:itemid/themesongs',
                'GET /items/:itemid/themevideos',
                'GET /items/counts',
                'GET /items/:itemid/remoteimages',
                'GET /items/:itemid/remoteimages/providers',
                'GET /items/suggestions',
                'GET /items/:itemid/intros',
                'GET /items/:itemid/localtrailers',
                'GET /items/:itemid/specialfeatures',
                'GET /items/root',
                'GET /movies/:itemid/similar',
                'GET /movies/recommendations',
                'GET /shows/:itemid/similar',
                'GET /shows/upcoming',
                'GET /trailers',
                'GET /trailers/:itemid/similar'
            ];

            for (const route of routes) {
                const [method, path] = route.split(' ');
                const handler = server.handlers.get(route);
                
                if (!handler) {
                    throw new Error(`Handler not found for ${route}`);
                }

                const req = { params: { itemid: '1', mediaid: '1' } };
                const res = makeRes();

                await handler(req, res);
                assert.ok(res.body, `Response body should exist for ${route}`);
            }
        });

        it('should return 404 for download/file routes', async () => {
            const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);

            const routes = [
                'GET /items/:itemid/download',
                'GET /items/:itemid/file',
                'GET /items/:itemid/remoteimages/download'
            ];

            for (const route of routes) {
                const handler = server.handlers.get(route);
                const req = { params: { itemid: '1' } };
                const res = makeRes();

                await handler(req, res);
                assert.equal(res.statusCode, 404, `Should be 404 for ${route}`);
            }
        });
        
        it('should return 204 for post actions', async () => {
             const server = makeServer();
            itemsRoutes(server as any, mockEmbyEmulation);
            
            const routes = [
                'POST /items/remotesearch/apply/:itemid',
                'POST /items/:itemid/refresh'
            ];
            
            for (const route of routes) {
                const handler = server.handlers.get(route);
                const req = { params: { itemid: '1' } };
                const res = makeRes();

                await handler(req, res);
                assert.equal(res.statusCode, 204, `Should be 204 for ${route}`);
            }
        });
    });
});
