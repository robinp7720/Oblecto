/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import moviesRoutes from '../../src/submodules/REST/routes/movies.js';
import episodesRoutes from '../../src/submodules/REST/routes/episodes.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';

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

describe('Media info routes include stream metadata', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
        EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });

        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });

        Episode.belongsToMany(File, { through: EpisodeFiles });
        File.belongsToMany(Episode, { through: EpisodeFiles });

        File.hasMany(Stream);
        Stream.belongsTo(File);

        Episode.belongsTo(Series);
        Series.hasMany(Episode);

        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });
        TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });

        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });

        await sequelize.sync({ force: true });

        const movie = await Movie.create({ movieName: 'Movie One' });
        const movieFile = await File.create({ path: '/tmp/movie-one.mkv' });
        await MovieFiles.create({ MovieId: movie.id, FileId: movieFile.id });
        await Stream.create({ FileId: movieFile.id, index: 0, codec_type: 'video', codec_name: 'h264' });

        const series = await Series.create({ seriesName: 'Series One' });
        const episode = await Episode.create({ episodeName: 'Episode One', airedSeason: 1, airedEpisodeNumber: 1, SeriesId: series.id });
        const episodeFile = await File.create({ path: '/tmp/episode-one.mkv' });
        await EpisodeFiles.create({ EpisodeId: episode.id, FileId: episodeFile.id });
        await Stream.create({ FileId: episodeFile.id, index: 1, codec_type: 'audio', codec_name: 'aac' });
    });

    it('GET /movie/:id/info includes file streams', async () => {
        const server = makeServer();
        moviesRoutes(server as any, {} as any);

        const handler = server.handlers.get('GET /movie/:id/info');
        const res = makeRes();

        await handler({ params: { id: '1' }, authorization: { user: { id: 1 } } }, res);

        assert.equal(res.statusCode, 200);
        assert.ok(res.body);
        assert.ok(Array.isArray(res.body.Files));
        assert.equal(res.body.Files.length, 1);
        assert.ok(Array.isArray(res.body.Files[0].Streams));
        assert.equal(res.body.Files[0].Streams[0].codec_type, 'video');
    });

    it('GET /episode/:id/info includes file streams', async () => {
        const server = makeServer();
        episodesRoutes(server as any, {} as any);

        const handler = server.handlers.get('GET /episode/:id/info');
        const res = makeRes();

        await handler({ params: { id: '1' }, authorization: { user: { id: 1 } } }, res);

        assert.equal(res.statusCode, 200);
        assert.ok(res.body);
        assert.ok(Array.isArray(res.body.Files));
        assert.equal(res.body.Files.length, 1);
        assert.ok(Array.isArray(res.body.Files[0].Streams));
        assert.equal(res.body.Files[0].Streams[0].codec_type, 'audio');
    });
});
