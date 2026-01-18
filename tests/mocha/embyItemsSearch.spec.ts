import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import itemsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/items/index.js';
import usersRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/users/index.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import { formatUuid } from '../../src/lib/embyEmulation/helpers.js';

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

describe('Emby items search routes', () => {
    let sequelize;
    let movie;
    let series;

    before(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite', storage: ':memory:', logging: false 
        });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
        EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });

        Episode.belongsTo(Series);
        Series.hasMany(Episode);

        Episode.belongsToMany(File, { through: EpisodeFiles });
        File.belongsToMany(Episode, { through: EpisodeFiles });
        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });
        Stream.belongsTo(File);
        File.hasMany(Stream);

        await sequelize.sync({ force: true });

        movie = await Movie.create({ movieName: 'Alpha', releaseDate: '2020-01-01' });
        series = await Series.create({ seriesName: 'Bravo', firstAired: '2021-01-01' });
        await Episode.create({
            episodeName: 'Pilot',
            airedSeason: '1',
            airedEpisodeNumber: '1',
            SeriesId: series.id
        });
    });

    it('handles includeItemTypes arrays for /items without throwing', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        itemsRoutes(server, embyEmulation);

        const handler = server.handlers.get('GET /items');
        const req = {
            query: {
                includeItemTypes: ['Movie', 'Series', 'MusicArtist'],
                sortBy: ['IsFavoriteOrLiked', 'Random'],
                limit: '20',
                startIndex: '0'
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.Items.length, 2);
        assert.strictEqual(res.body.TotalRecordCount, 2);
        const names = res.body.Items.map(item => item.Name).sort();

        assert.deepStrictEqual(names, ['Alpha', 'Bravo']);
    });

    it('returns search hints for /search/hints with array params', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        itemsRoutes(server, embyEmulation);

        const handler = server.handlers.get('GET /search/hints');
        const req = {
            query: {
                searchTerm: 'Alpha',
                includeItemTypes: ['Movie', 'Series'],
                limit: '10',
                startIndex: '0'
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.SearchHints.length, 1);
        assert.strictEqual(res.body.SearchHints[0].Name, 'Alpha');
        assert.strictEqual(res.body.SearchHints[0].Type, 'Movie');
    });

    it('handles includeItemTypes arrays for /users/:userid/items', async () => {
        const server = makeServer();
        const embyEmulation = { serverId: 'test-server-id' };

        usersRoutes(server, embyEmulation);

        const handler = server.handlers.get('GET /users/:userid/items');
        const req = {
            params: { userid: formatUuid(1) },
            query: {
                includeItemTypes: ['Movie'],
                searchTerm: 'Alpha',
                limit: '10',
                startIndex: '0'
            }
        };
        const res = makeRes();

        await handler(req, res);

        assert.ok(res.body);
        assert.strictEqual(res.body.Items.length, 1);
        assert.strictEqual(res.body.Items[0].Name, movie.movieName);
    });
});
