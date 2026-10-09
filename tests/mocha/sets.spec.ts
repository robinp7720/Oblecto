import assert from 'node:assert/strict';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Server } from 'node:http';
import { Model, Sequelize, type BelongsToMany } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import config from '../../src/config.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { MovieSet, movieSetColumns } from '../../src/models/movieSet.js';
import { SeriesSet, seriesSetColumns } from '../../src/models/seriesSet.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import movieRoutes from '../../src/submodules/REST/routes/movies.js';
import seriesRoutes from '../../src/submodules/REST/routes/tvshows.js';
import setRoutes from '../../src/submodules/REST/routes/sets.js';
import { visibleSets as jellyfinVisibleSets } from '../../src/lib/embyEmulation/ServerAPI/library.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';
import type { HttpError } from '../../src/submodules/REST/errors.js';

describe('Native set privacy and validation', () => {
    let sequelize: Sequelize;
    let server: Server;
    let base: string;
    let owner: User;
    let other: User;
    let member: User;
    let movie: Movie;
    let series: Series;
    let publicMovie: MovieSet;
    let privateMovie: MovieSet;
    let hiddenMovie: MovieSet;
    let publicSeries: SeriesSet;
    let privateSeries: SeriesSet;
    let hiddenSeries: SeriesSet;

    async function call(method: string, url: string, user?: User, body?: object) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (user) headers.Authorization = `Bearer ${issueAccessToken(user, config.authentication)}`;
        const response = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(3000) });
        return { status: response.status, body: await response.json() };
    }

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        MovieSet.init(movieSetColumns, { sequelize, modelName: 'MovieSet' });
        SeriesSet.init(seriesSetColumns, { sequelize, modelName: 'SeriesSet' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        if (!MovieSet.associations.Movies) MovieSet.belongsToMany(Movie, { through: 'MovieSetAllocations' });
        if (!Movie.associations.MovieSets) Movie.belongsToMany(MovieSet, { through: 'MovieSetAllocations' });
        if (!MovieSet.associations.Users) MovieSet.belongsToMany(User, { through: 'MovieSetUsers' });
        if (!SeriesSet.associations.Series) SeriesSet.belongsToMany(Series, { through: 'SeriesSetAllocations' });
        if (!Series.associations.SeriesSets) Series.belongsToMany(SeriesSet, { through: 'SeriesSetAllocations' });
        if (!SeriesSet.associations.Users) SeriesSet.belongsToMany(User, { through: 'SeriesSetUsers' });
        if (!Movie.associations.TrackMovies) Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });
        // Earlier suites keep association aliases on these shared model classes. Register
        // their implicit join models on this suite's database rather than the closed one.
        for (const model of [MovieSet, Movie, SeriesSet, Series]) {
            for (const association of Object.values(model.associations)) {
                if (association.associationType !== 'BelongsToMany') continue;
                const through = (association as BelongsToMany).through.model;
                if (through.sequelize !== sequelize) through.init(through.getAttributes(), { sequelize, modelName: through.name });
                const relation = association as unknown as {
                    accessors: { add: string };
                    add(instance: Model, target: Model | number, options?: object): Promise<void>;
                };
                // Old injected methods close over old association instances even after init.
                Object.defineProperty(model.prototype, relation.accessors.add, {
                    configurable: true, writable: true,
                    value: function (this: Model, target: Model | number, options?: object) { return relation.add(this, target, options); }
                });
            }
        }
        await sequelize.sync();
        const managers = await Group.create({ name: 'Managers', permissions: ['libraries.manage'], builtIn: false });
        owner = await User.create({ username: 'owner', password: null, groupId: managers.id });
        other = await User.create({ username: 'other', password: null, groupId: managers.id });
        member = await User.create({ username: 'member', password: null, groupId: null });
        movie = await Movie.create({ movieName: 'Film' });
        series = await Series.create({ seriesName: 'Show' });
        publicMovie = await MovieSet.create({ setName: 'Public movies', public: true });
        privateMovie = await MovieSet.create({ setName: 'Shared movies', public: false });
        hiddenMovie = await MovieSet.create({ setName: 'Hidden movies', public: false });
        publicSeries = await SeriesSet.create({ setName: 'Public shows', public: true });
        privateSeries = await SeriesSet.create({ setName: 'Shared shows', public: false });
        hiddenSeries = await SeriesSet.create({ setName: 'Hidden shows', public: false });
        await privateMovie.addUser(owner);
        await privateSeries.addUser(owner);
        await hiddenMovie.addUser(other);
        await hiddenSeries.addUser(other);
        for (const set of [publicMovie, privateMovie, hiddenMovie]) await set.addMovie(movie);
        for (const set of [publicSeries, privateSeries, hiddenSeries]) await set.addSeries(series);
        await TrackMovie.create({ movieId: movie.id, userId: other.id, time: 500, progress: 0.5 });

        const app = express();
        app.use(express.json());
        app.use((req: OblectoRequest, _res: Response, next: NextFunction) => {
            const [scheme, credentials] = (req.headers.authorization ?? '').split(' ');
            if (credentials) req.authorization = { scheme, credentials };
            req.combined_params = { ...req.query, ...req.body };
            next();
        });
        movieRoutes(app, {} as Oblecto);
        seriesRoutes(app, {} as Oblecto);
        setRoutes(app, {} as Oblecto);
        app.use((error: HttpError, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message });
        });
        server = app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });

    after(async () => {
        if (server) await new Promise<void>(resolve => server.close(() => resolve()));
        await sequelize.close();
    });

    for (const kind of ['movie', 'series'] as const) {
        const prefix = kind === 'movie' ? 'movies' : 'series';
        const mediaId = () => kind === 'movie' ? movie.id : series.id;
        const visible = () => kind === 'movie' ? [publicMovie.id, privateMovie.id] : [publicSeries.id, privateSeries.id];
        const privateId = () => kind === 'movie' ? privateMovie.id : privateSeries.id;
        const hidden = () => kind === 'movie' ? hiddenMovie : hiddenSeries;

        it(`filters ${kind} set listings and media memberships by the authenticated user`, async () => {
            for (const url of [`/${prefix}/sets`, `/${kind}/${mediaId()}/sets`]) {
                const result = await call('GET', url, owner);
                assert.equal(result.status, 200);
                assert.deepEqual(result.body.map((set: { id: number }) => set.id).sort(), visible().sort());
                assert.equal((await call('GET', url)).status, 401);
                const unshared = await call('GET', url, member);
                assert.equal(unshared.body.length, 1);
            }
        });

        it(`hides ${kind} details and contents even when the caller supplies another user's id`, async () => {
            const result = await call('GET', `/${prefix}/set/${hidden().id}?userId=${other.id}`, owner);
            assert.equal(result.status, 200);
            assert.deepEqual(result.body, []);
            assert.deepEqual((await call('GET', `/${prefix}/set/99999`, owner)).body, []);
            const shared = await call('GET', `/${prefix}/set/${privateId()}`, owner);
            assert.equal(shared.body[0].id, privateId());
            assert.equal(shared.body[0][kind === 'movie' ? 'Movies' : 'Series'][0].id, mediaId());
            if (kind === 'movie') assert.deepEqual(shared.body[0].Movies[0].TrackMovies, []);
        });

        it(`rejects invalid ${kind} creation without hanging or writing a set`, async () => {
            const invalid = [
                { name: 'Bad set' }, { name: 'Bad set', public: 'false' }, { name: 'Bad set', public: 1 },
                { name: 'Bad set', public: null }, { name: ' ', public: false }, { public: true },
                { name: 42, public: true }, { name: 'x'.repeat(256), public: true }, { name: 'Bad set', public: false, overview: {} }
            ];
            for (const body of invalid) {
                const result = await call('POST', `/set/${kind}`, owner, body);
                assert.equal(result.status, 400, JSON.stringify(body));
            }
            const model = kind === 'movie' ? MovieSet : SeriesSet;
            assert.equal(await model.count(), 3);
            assert.equal((await call('POST', `/set/${kind}`, member, { name: 'Denied', public: true })).status, 403);
        });

        it(`keeps new private ${kind} sets visible to their creator without disclosing them to another manager`, async () => {
            const created = await call('POST', `/set/${kind}`, owner, { name: `  My ${kind} set  `, public: false });
            assert.equal(created.status, 200);
            assert.equal(created.body.setName, `My ${kind} set`);
            assert.equal(created.body.public, false);
            const list = await call('GET', `/${prefix}/sets`, owner);
            assert.ok(list.body.some((set: { id: number }) => set.id === created.body.id));
            assert.deepEqual((await call('GET', `/${prefix}/set/${created.body.id}`, other)).body, []);
            const repeated = await call('POST', `/set/${kind}`, owner, { name: `My ${kind} set`, public: true, overview: 'changed' });
            assert.equal(repeated.body.id, created.body.id);
            assert.equal(repeated.body.public, false);
            const denied = await call('POST', `/set/${kind}`, other, { name: `My ${kind} set`, public: true });
            assert.equal(denied.status, 404);
            assert.equal(denied.body.setName, undefined);
        });
    }

    it('uses the same movie visibility policy in Jellyfin', async () => {
        const visible = await MovieSet.findAll({ where: jellyfinVisibleSets(owner.id) });
        assert.ok(visible.some(set => set.id === privateMovie.id));
        assert.ok(!visible.some(set => set.id === hiddenMovie.id));
    });
});
