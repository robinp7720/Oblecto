import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';
import authRoutes from '../../src/submodules/REST/routes/auth.js';
import clientsRoutes from '../../src/submodules/REST/routes/clients.js';
import usersRoutes from '../../src/submodules/REST/routes/users.js';
import setsRoutes from '../../src/submodules/REST/routes/sets.js';
import filesRoutes from '../../src/submodules/REST/routes/files.js';
import { User, userColumns } from '../../src/models/user.js';
import { MovieSet, movieSetColumns } from '../../src/models/movieSet.js';
import { SeriesSet, seriesSetColumns } from '../../src/models/seriesSet.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Movie, movieColumns } from '../../src/models/movie.js';

const makeServer = () => {
    const handlers = new Map();
    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
    };
    return { handlers, get: register('GET'), post: register('POST'), put: register('PUT'), delete: register('DELETE'), patch: register('PATCH') };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    send(payload: any) { this.body = payload; return this; }
});

describe('auth route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        await sequelize.sync({ force: true });
    });

    afterEach(async () => { await User.destroy({ where: {}, truncate: true }); });

    const makeOblecto = (overrides: Record<string, any> = {}) => ({
        config: { authentication: { secret: 'test-secret', allowPasswordlessLogin: false } },
        ...overrides
    });

    it('logs in with a correct password and returns a signed token', async () => {
        const hash = await bcrypt.hash('correct-horse', 10);
        await User.create({ username: 'robin', name: 'Robin', email: 'r@x.com', password: hash });

        const server = makeServer();
        authRoutes(server as any, makeOblecto());

        const req: any = { body: { username: 'robin', password: 'correct-horse' } };
        const res = makeRes();
        const next = (err: any) => { throw err; };

        await server.handlers.get('POST /auth/login')(req, res, next);

        assert.ok(res.body.accessToken);
    });

    it('rejects an incorrect password', async () => {
        const hash = await bcrypt.hash('correct-horse', 10);
        await User.create({ username: 'robin', password: hash });

        const server = makeServer();
        authRoutes(server as any, makeOblecto());

        const req: any = { body: { username: 'robin', password: 'wrong' } };
        const res = makeRes();
        let error: any;
        await server.handlers.get('POST /auth/login')(req, res, (err: any) => { error = err; });

        assert.equal(error.statusCode, 401);
    });

    it('rejects a login for a nonexistent user', async () => {
        const server = makeServer();
        authRoutes(server as any, makeOblecto());

        const req: any = { body: { username: 'ghost', password: 'x' } };
        const res = makeRes();
        let error: any;
        await server.handlers.get('POST /auth/login')(req, res, (err: any) => { error = err; });

        assert.equal(error.statusCode, 401);
    });

    it('rejects a missing username', async () => {
        const server = makeServer();
        authRoutes(server as any, makeOblecto());

        const req: any = { body: {} };
        const res = makeRes();
        let error: any;
        await server.handlers.get('POST /auth/login')(req, res, (err: any) => { error = err; });

        assert.equal(error.statusCode, 400);
    });

    it('allows passwordless login when configured and the user has no password', async () => {
        await User.create({ username: 'nopass', password: null });

        const server = makeServer();
        authRoutes(server as any, makeOblecto({ config: { authentication: { secret: 's', allowPasswordlessLogin: true } } }));

        const req: any = { body: { username: 'nopass' } };
        const res = makeRes();
        const next = (err: any) => { throw err; };

        await server.handlers.get('POST /auth/login')(req, res, next);

        assert.ok(res.body.accessToken);
    });
});

describe('clients route', () => {
    it('lists only clients belonging to the authenticated user', async () => {
        const oblecto = {
            realTimeController: {
                clients: {
                    c1: { user: { id: 1 }, clientName: 'Phone' },
                    c2: { user: { id: 2 }, clientName: 'Other' }
                }
            }
        };

        const server = makeServer();
        clientsRoutes(server as any, oblecto as any);

        const req: any = { authorization: { user: { id: 1 } } };
        const res = makeRes();

        await server.handlers.get('GET /clients')(req, res);

        assert.deepEqual(res.body, [{ clientId: 'c1', clientName: 'Phone' }]);
    });

    it('returns 404 when the target client does not exist', async () => {
        const oblecto = { realTimeController: { clients: {} } };
        const server = makeServer();
        clientsRoutes(server as any, oblecto as any);

        const req: any = { params: { clientId: 'missing' }, combined_params: { type: 'movie' } };
        const res = makeRes();

        await server.handlers.get('POST /client/:clientId/playback')(req, res);

        assert.equal(res.statusCode, 404);
    });

    it('dispatches playback commands to the target client', async () => {
        const calls: string[] = [];
        const oblecto = {
            realTimeController: {
                clients: { c1: { playMovie: (id: string) => calls.push(`movie:${id}`), playEpisode: (id: string) => calls.push(`episode:${id}`) } }
            }
        };
        const server = makeServer();
        clientsRoutes(server as any, oblecto as any);

        const req: any = { params: { clientId: 'c1', id: '99' }, combined_params: { type: 'movie' } };
        const res = makeRes();

        await server.handlers.get('POST /client/:clientId/playback')(req, res);

        assert.deepEqual(calls, ['movie:99']);
    });
});

describe('users route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        await sequelize.sync({ force: true });
    });

    afterEach(async () => { await User.destroy({ where: {}, truncate: true }); });

    const oblecto = { config: { authentication: { saltRounds: 4 } } } as any;

    it('lists users without exposing extra fields', async () => {
        await User.create({ username: 'a', name: 'A', email: 'a@x.com', password: 'hash' });

        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const res = makeRes();
        await server.handlers.get('GET /users')({} as any, res);

        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].username, 'a');
    });

    it('deletes a user and returns their info first', async () => {
        const user = await User.create({ username: 'todelete' });

        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const res = makeRes();
        await server.handlers.get('DELETE /user/:id')({ params: { id: String(user.id) } } as any, res);

        assert.equal(res.body.username, 'todelete');
        assert.equal(await User.count(), 0);
    });

    it('returns 404 when deleting a nonexistent user', async () => {
        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const res = makeRes();
        await server.handlers.get('DELETE /user/:id')({ params: { id: '999' } } as any, res);

        assert.equal(res.statusCode, 404);
    });

    it('updates user fields including hashing a new password', async () => {
        const user = await User.create({ username: 'old' });

        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const req: any = { params: { id: String(user.id) }, combined_params: { username: 'new', password: 'newpass', email: 'e@x.com', name: 'New Name' } };
        const res = makeRes();

        await server.handlers.get('PUT /user/:id')(req, res);

        await user.reload();
        assert.equal(user.username, 'new');
        assert.equal(user.email, 'e@x.com');
        assert.ok(await bcrypt.compare('newpass', user.password as string));
    });

    it('rejects updating a nonexistent user', async () => {
        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const req: any = { params: { id: '999' }, combined_params: {} };
        const res = makeRes();

        await server.handlers.get('PUT /user/:id')(req, res);

        assert.equal(res.statusCode, 400);
    });

    it('creates a new user, requiring username/email/name', async () => {
        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const res1 = makeRes();
        await server.handlers.get('POST /user')({ combined_params: {} } as any, res1);
        assert.equal(res1.statusCode, 400);

        const res2 = makeRes();
        await server.handlers.get('POST /user')({ combined_params: { username: 'x', email: 'x@x.com', name: 'X', password: 'pw' } } as any, res2);

        assert.equal(res2.body.username, 'x');
        const created = await User.findOne({ where: { username: 'x' } });
        assert.ok(created?.password);
    });

    it('is idempotent for repeated user creation with the same username', async () => {
        const server = makeServer();
        usersRoutes(server as any, oblecto);

        const req: any = { combined_params: { username: 'dup', email: 'd@x.com', name: 'Dup' } };
        await server.handlers.get('POST /user')(req, makeRes());
        await server.handlers.get('POST /user')(req, makeRes());

        assert.equal(await User.count({ where: { username: 'dup' } }), 1);
    });
});

describe('sets route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        MovieSet.init(movieSetColumns, { sequelize, modelName: 'MovieSet' });
        SeriesSet.init(seriesSetColumns, { sequelize, modelName: 'SeriesSet' });
        await sequelize.sync({ force: true });
    });

    afterEach(async () => {
        await MovieSet.destroy({ where: {}, truncate: true });
        await SeriesSet.destroy({ where: {}, truncate: true });
    });

    it('creates a movie set', async () => {
        const server = makeServer();
        setsRoutes(server as any, {} as any);

        const req: any = { combined_params: { name: 'War Films', overview: 'x', public: true } };
        const res = makeRes();

        await server.handlers.get('POST /set/movie')(req, res);

        assert.equal(res.body.setName, 'War Films');
    });

    it('deletes a movie set, 404s when missing', async () => {
        const set = await MovieSet.create({ setName: 'X' });

        const server = makeServer();
        setsRoutes(server as any, {} as any);

        const res1 = makeRes();
        await server.handlers.get('DELETE /set/movie/:id')({ params: { id: String(set.id) } } as any, res1);
        assert.deepEqual(res1.body, { success: true });
        assert.equal(await MovieSet.count(), 0);
    });

    it('creates and deletes a series set', async () => {
        const server = makeServer();
        setsRoutes(server as any, {} as any);

        const createReq: any = { combined_params: { name: 'Superhero Shows', overview: '', public: false } };
        const createRes = makeRes();
        await server.handlers.get('POST /set/series')(createReq, createRes);
        assert.equal(createRes.body.setName, 'Superhero Shows');

        const deleteRes = makeRes();
        await server.handlers.get('DELETE /set/series/:id')({ params: { id: String(createRes.body.id) } } as any, deleteRes);
        assert.deepEqual(deleteRes.body, { success: true });
    });
});

describe('files route', () => {
    let sequelize: Sequelize;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        await sequelize.sync({ force: true });
    });

    afterEach(async () => {
        await File.destroy({ where: {}, truncate: true });
    });

    it('lists problematic files', async () => {
        await File.create({ path: '/a.mkv', problematic: true, error: 'bad file' });
        await File.create({ path: '/b.mkv', problematic: false });

        const server = makeServer();
        filesRoutes(server as any, {} as any);

        const res = makeRes();
        await server.handlers.get('GET /files/problematic')({} as any, res);

        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].path, '/a.mkv');
    });

    it('retry: routes a movie-directory file to indexMovie with doReIndex', async () => {
        const file = await File.create({ path: '/library/movies/x.mkv', problematic: true, error: 'oops' });
        const queued: any[] = [];
        const oblecto = {
            config: { movies: { directories: [{ path: '/library/movies' }] }, tvshows: { directories: [] } },
            queue: { queueJob: (id: string, attr: any) => queued.push({ id, attr }) }
        };

        const server = makeServer();
        filesRoutes(server as any, oblecto as any);

        const req: any = { params: { id: String(file.id) } };
        const res = makeRes();
        const next = (err: any) => { throw err; };

        await server.handlers.get('POST /files/:id/retry')(req, res, next);

        await file.reload();
        assert.equal(file.problematic, false);
        assert.equal(queued[0].id, 'indexMovie');
        assert.equal(queued[0].attr.doReIndex, true);
    });

    it('retry: routes a tvshows-directory file to indexEpisode', async () => {
        const file = await File.create({ path: '/library/series/x.mkv' });
        const queued: any[] = [];
        const oblecto = {
            config: { movies: { directories: [{ path: '/library/movies' }] }, tvshows: { directories: [{ path: '/library/series' }] } },
            queue: { queueJob: (id: string, attr: any) => queued.push({ id, attr }) }
        };

        const server = makeServer();
        filesRoutes(server as any, oblecto as any);

        await server.handlers.get('POST /files/:id/retry')({ params: { id: String(file.id) } } as any, makeRes(), (err: any) => { throw err; });

        assert.equal(queued[0].id, 'indexEpisode');
    });

    it('retry: falls back to indexFileStreams when the path matches no configured directory', async () => {
        const file = await File.create({ path: '/somewhere/else/x.mkv' });
        const queued: any[] = [];
        const oblecto = {
            config: { movies: { directories: [{ path: '/library/movies' }] }, tvshows: { directories: [{ path: '/library/series' }] } },
            queue: { queueJob: (id: string, attr: any) => queued.push({ id, attr }) }
        };

        const server = makeServer();
        filesRoutes(server as any, oblecto as any);

        await server.handlers.get('POST /files/:id/retry')({ params: { id: String(file.id) } } as any, makeRes(), (err: any) => { throw err; });

        assert.equal(queued[0].id, 'indexFileStreams');
    });

    it('retry: 404s for an unknown file id', async () => {
        const oblecto = { config: { movies: { directories: [] }, tvshows: { directories: [] } }, queue: { queueJob: () => {} } };
        const server = makeServer();
        filesRoutes(server as any, oblecto as any);

        const res = makeRes();
        await server.handlers.get('POST /files/:id/retry')({ params: { id: '999' } } as any, res, (err: any) => { throw err; });

        assert.equal(res.statusCode, 404);
    });
});
