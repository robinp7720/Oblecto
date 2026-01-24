/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import sessionsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/sessions/index.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { File, fileColumns } from '../../src/models/file.js';
import { formatId } from '../../src/lib/embyEmulation/helpers.js';

const makeServer = () => {
    const handlers = new Map();

    const register = (method) => (route, handler) => {
        // Express routes often have params like :id, we'll need a simple matching if we want to be generic,
        // but for this specific test we know the exact route.
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

describe('Emby sessions playing progress route', () => {
    let sequelize;
    let episode, movie;
    const userId = 1;
    const token = 'test-token';
    const playSessionId = 'test-play-session';

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

        // Associations
        Episode.hasMany(File);
        File.belongsTo(Episode);
        Movie.hasMany(File);
        File.belongsTo(Movie);
        
        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });
        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });

        await sequelize.sync({ force: true });

        // Create test data
        episode = await Episode.create({
            episodeName: 'Test Episode',
            airedSeason: 1,
            airedEpisodeNumber: 1,
            runtime: 30, // 30 minutes
        });
        await File.create({ duration: 30 * 60, EpisodeId: episode.id });

        movie = await Movie.create({
            title: 'Test Movie',
            runtime: 120, // 120 minutes
        });
        await File.create({ duration: 120 * 60, MovieId: movie.id });
    });

    it('updates progress for an episode', async () => {
        const server = makeServer();
        const embyEmulation = {sessions: {[token]: {Id: userId}}};

        sessionsRoutes(server, embyEmulation);

        const handler = server.handlers.get('POST /sessions/playing/progress');
        
        const episodeEmbyId = formatId(episode.id, 'episode');
        // 15 minutes in ticks (1 tick = 10000 ms ?? No, 1 tick = 100ns = 0.0001 ms usually in .NET/Emby)
        // Wait, Oblecto implementation says: const time = parseInt(PositionTicks || 0) / 10000000;
        // So 10,000,000 ticks = 1 second.
        // 15 minutes = 15 * 60 = 900 seconds.
        // Ticks = 900 * 10,000,000 = 9,000,000,000
        const positionTicks = 900 * 10000000;

        const req = {
            headers: {'x-emby-token': token},
            query: {
                ItemId: episodeEmbyId,
                PositionTicks: positionTicks.toString(),
                PlaySessionId: playSessionId
            },
            body: {}
        };
        const res = makeRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 204);

        // Verify TrackEpisode updated
        const track = await TrackEpisode.findOne({ where: { userId, episodeId: episode.id } });
        assert.ok(track, 'TrackEpisode should exist');
        assert.strictEqual(track.time, 900); // 900 seconds
        assert.ok(Math.abs(track.progress - 0.5) < 0.01, 'Progress should be approx 0.5');

        // Verify session state updated
        const session = embyEmulation.sessions[token];
        assert.ok(session.playbackState);
        assert.ok(session.playbackState.playSessions.has(playSessionId));
        const entry = session.playbackState.playSessions.get(playSessionId);
        assert.strictEqual(entry.itemId, episodeEmbyId);
    });

    it('updates progress for a movie', async () => {
        const server = makeServer();
        const embyEmulation = {sessions: {[token]: {Id: userId}}};

        sessionsRoutes(server, embyEmulation);

        const handler = server.handlers.get('POST /sessions/playing/progress');
        
        const movieEmbyId = formatId(movie.id, 'movie');
        // 30 minutes in ticks
        const positionTicks = 30 * 60 * 10000000;

        const req = {
            headers: {'x-emby-token': token},
            query: {},
            body: {
                ItemId: movieEmbyId,
                PositionTicks: positionTicks.toString(),
                PlaySessionId: playSessionId
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 204);

        // Verify TrackMovie updated
        const track = await TrackMovie.findOne({ where: { userId, movieId: movie.id } });
        assert.ok(track, 'TrackMovie should exist');
        assert.strictEqual(track.time, 1800); // 30 * 60 seconds
        assert.ok(Math.abs(track.progress - 0.25) < 0.01, 'Progress should be approx 0.25');
    });

    it('returns 401 if unauthorized', async () => {
        const server = makeServer();
        const embyEmulation = { sessions: {} };
        sessionsRoutes(server, embyEmulation);

        const handler = server.handlers.get('POST /sessions/playing/progress');
        const req = {
            headers: {'x-emby-token': 'invalid-token'},
            query: {},
            body: {}
        };
        const res = makeRes();

        await handler(req, res);
        assert.strictEqual(res.statusCode, 401);
    });

    it('returns 400 if missing ItemId', async () => {
        const server = makeServer();
        const embyEmulation = {sessions: {[token]: { Id: userId }}};
        sessionsRoutes(server, embyEmulation);

        const handler = server.handlers.get('POST /sessions/playing/progress');
        const req = {
            headers: {'x-emby-token': token},
            query: {},
            body: {
                // ItemId missing
                PositionTicks: '10000'
            }
        };
        const res = makeRes();

        await handler(req, res);
        assert.strictEqual(res.statusCode, 400);
    });
});
