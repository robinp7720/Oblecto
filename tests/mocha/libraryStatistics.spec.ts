import assert from 'node:assert/strict';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Sequelize } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { libraryStatistics } from '../../src/lib/statistics/libraries.js';
import statisticsRoutes from '../../src/submodules/REST/routes/v1/statistics.js';
import librariesRoutes from '../../src/submodules/REST/routes/v1/libraries.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import config from '../../src/config.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';
import type { IConfig } from '../../src/interfaces/config.js';

const configuration = (movies: string[], tvshows: string[] = []): Pick<IConfig, 'movies' | 'tvshows'> => ({
    movies: { ...config.movies, directories: movies.map(path => ({ path })) },
    tvshows: { ...config.tvshows, directories: tvshows.map(path => ({ path })) }
});

describe('Per-library statistics', () => {
    let database: Sequelize;
    beforeEach(async () => {
        database = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        File.init(fileColumns, { sequelize: database, modelName: 'File' });
        Movie.init(movieColumns, { sequelize: database, modelName: 'Movie' });
        Series.init(seriesColumns, { sequelize: database, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize: database, modelName: 'Episode' });
        MovieFiles.init(movieFileColumns, { sequelize: database, modelName: 'MovieFiles' });
        EpisodeFiles.init(episodeFilesColumns, { sequelize: database, modelName: 'EpisodeFiles' });
        User.init(userColumns, { sequelize: database, modelName: 'User' });
        Group.init(groupColumns, { sequelize: database, modelName: 'Group' });
        await database.sync();
    });
    afterEach(async () => { await database.close(); });

    it('returns configured empty folders and an empty array for no configuration', async () => {
        assert.deepEqual(await libraryStatistics(database, configuration([])), []);
        assert.deepEqual(await libraryStatistics(database, configuration(['/movies'], ['/shows'])), [
            { type: 'movies', path: '/movies', movies: 0, series: 0, episodes: 0, files: 0, localBytes: 0, missingSize: 0, problematicFiles: 0 },
            { type: 'tvshows', path: '/shows', movies: 0, series: 0, episodes: 0, files: 0, localBytes: 0, missingSize: 0, problematicFiles: 0 }
        ]);
    });

    it('counts distinct titles and files independently, including unmatched and ignored problems', async () => {
        const movie = await Movie.create({ movieName: 'Movie' });
        const series = await Series.create({ seriesName: 'Series' });
        const episodes = await Episode.bulkCreate([1, 2].map(n => ({ airedSeason: '1', airedEpisodeNumber: String(n), SeriesId: series.id })));
        const files = await File.bulkCreate([
            { path: '/media/movie.mkv', host: 'local', size: 100 },
            { path: '/media/movie-alt.mkv', host: '', size: 200 },
            { path: '/media/tv/double.mkv', host: null, size: 300 },
            { path: '/media/tv/unmatched.mkv', host: 'local', size: null, problematic: true, problemIgnored: true },
            { path: '/media/remote.mkv', host: 'peer', size: 9999 },
            { path: '/elsewhere/movie.mkv', host: 'local', size: 400 }
        ]);
        await MovieFiles.bulkCreate([0, 1, 4, 5].map(i => ({ MovieId: movie.id, FileId: files[i].id })));
        await EpisodeFiles.bulkCreate(episodes.map(episode => ({ EpisodeId: episode.id, FileId: files[2].id })));
        const rows = await libraryStatistics(database, configuration(['/media'], ['/media/tv']));
        assert.deepEqual(rows[0], { type: 'movies', path: '/media', movies: 1, series: 1, episodes: 2, files: 4, localBytes: 600, missingSize: 1, problematicFiles: 1 });
        assert.deepEqual(rows[1], { type: 'tvshows', path: '/media/tv', movies: 0, series: 1, episodes: 2, files: 2, localBytes: 300, missingSize: 1, problematicFiles: 1 });
    });

    it('normalizes paths lexically, matches boundaries and treats SQL wildcards literally', async () => {
        await File.bulkCreate([
            { path: 'relative/media/film.mkv', size: 1 },
            { path: path.resolve('relative/media/sub/../two.mkv'), size: 2 },
            { path: path.resolve('relative/media/..hidden/film.mkv'), size: 4 },
            { path: 'relative/media-other/film.mkv', size: 8 },
            { path: 'relative/media/../outside.mkv', size: 16 },
            { path: 'relative/100%_movies/film.mkv', size: 32 },
            { path: 'relative/100XXmovies/film.mkv', size: 64 },
            { path: null, size: 128 },
            { path: '', size: 256 },
            { path: 'relative/media', size: 512 }
        ]);
        const rows = await libraryStatistics(database, configuration(['relative/media/', path.resolve('relative/media'), 'relative/100%_movies']));
        assert.deepEqual(rows.map(row => [row.files, row.localBytes]), [[3, 7], [3, 7], [1, 32]]);
        const [root] = await libraryStatistics(database, configuration([path.parse(process.cwd()).root]));
        assert.equal(root.files, 8);
    });

    it('retains distinct counts across bounded batches and reads configuration changes immediately', async () => {
        const movie = await Movie.create({ movieName: 'Many versions' });
        const files = await File.bulkCreate(Array.from({ length: 501 }, (_, i) => ({ path: `/movies/${i}.mkv`, size: 1 })));
        await MovieFiles.bulkCreate(files.map(file => ({ FileId: file.id, MovieId: movie.id })));
        const current = configuration(['/movies']);
        const [row] = await libraryStatistics(database, current);
        assert.equal(row.movies, 1);
        assert.equal(row.files, 501);
        assert.equal(row.localBytes, 501);
        current.movies.directories = [{ path: '/new' }];
        assert.equal((await libraryStatistics(database, current))[0].files, 0);
    });

    it('keeps manager and statistics-viewer permissions separate and preserves server totals', async () => {
        const managerGroup = await Group.create({ name: 'Managers', permissions: ['libraries.manage'] });
        const viewerGroup = await Group.create({ name: 'Viewers', permissions: ['statistics.view'] });
        const manager = await User.create({ username: 'manager', groupId: managerGroup.id });
        const viewer = await User.create({ username: 'viewer', groupId: viewerGroup.id });
        const member = await User.create({ username: 'member' });
        await File.bulkCreate([{ path: '/movies/one.mkv', size: 10 }, { path: '/movies/remote.mkv', size: 100, host: 'peer' }]);
        const current = configuration(['/movies']);
        const oblecto = { database, config: current } as Oblecto;
        const app = express();
        app.use((req: OblectoRequest, _res, next) => {
            const [scheme, credentials] = (req.headers.authorization ?? '').split(' ');
            if (credentials) req.authorization = { scheme, credentials } as OblectoRequest['authorization'];
            next();
        });
        librariesRoutes(app, oblecto);
        statisticsRoutes(app, oblecto);
        app.use((error: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => res.status(error.statusCode ?? 500).json({ message: error.message }));
        const server: Server = app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => server.once('listening', resolve));
        const get = (url: string, user?: User) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${url}`, { headers: user ? { Authorization: `Bearer ${issueAccessToken(user, config.authentication)}` } : {} });
        try {
            for (const endpoint of ['/api/v1/libraries/statistics', '/api/v1/statistics/server/library']) {
                assert.equal((await get(endpoint)).status, 401);
                assert.equal((await get(endpoint, member)).status, 403);
            }
            assert.equal((await get('/api/v1/libraries/statistics', viewer)).status, 403);
            const folders = await get('/api/v1/libraries/statistics', manager);
            assert.equal(folders.status, 200);
            const body = await folders.json();
            assert.equal(body.libraries[0].files, 1);
            for (const endpoint of ['library', 'summary', 'history', 'health']) assert.equal((await get(`/api/v1/statistics/server/${endpoint}`, manager)).status, 403);
            const totals = await get('/api/v1/statistics/server/library', viewer);
            assert.equal(totals.status, 200);
            assert.deepEqual(await totals.json(), { movies: 0, series: 0, episodes: 0, files: 2, localBytes: 10, remoteFiles: 1, missingSize: 0, problematicFiles: 0, libraries: body.libraries });
            current.movies.directories = [];
            assert.deepEqual(await (await get('/api/v1/libraries/statistics', manager)).json(), { libraries: [] });
            await managerGroup.update({ permissions: [] });
            assert.equal((await get('/api/v1/libraries/statistics', manager)).status, 403);
        } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    });
});
