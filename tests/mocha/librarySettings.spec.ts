import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Sequelize } from 'sequelize';
import config, { ConfigManager } from '../../src/config.js';
import { ConfigWriter } from '../../src/lib/settings/ConfigWriter.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import OblectoAPI from '../../src/submodules/REST/index.js';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';

describe('Library settings HTTP contract', () => {
    let database: Sequelize;
    let api: OblectoAPI;
    let current: typeof config;
    let base: string;
    let manager: string;
    let viewer: string;
    let writes: string[];
    const original = ConfigManager.updateConfig;

    beforeEach(async () => {
        database = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize: database, modelName: 'User' });
        Group.init(groupColumns, { sequelize: database, modelName: 'Group' });
        await database.sync({ force: true });
        const group = await Group.create({ name: 'Library managers', permissions: ['libraries.manage'] });
        const limited = await Group.create({ name: 'Viewers', permissions: [] });
        manager = issueAccessToken(await User.create({ username: 'manager', groupId: group.id }), config.authentication);
        viewer = issueAccessToken(await User.create({ username: 'viewer', groupId: limited.id }), config.authentication);
        current = structuredClone(config);
        current.server.port = 0;
        current.web.enabled = false;
        current.movies.directories = [];
        writes = [];
        const writer = new ConfigWriter(() => '/unused', async (_path, contents) => { writes.push(contents); });
        ConfigManager.updateConfig = (change, target) => writer.update(target!, change);
        // Only settings routes are exercised; the application container is a wiring seam.
        const services: Pick<Oblecto, 'config' | 'database'> = { config: current, database };
        api = new OblectoAPI(services as Oblecto);
        await api.start();
        base = `http://127.0.0.1:${(api.server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        ConfigManager.updateConfig = original;
        await api?.close();
        await database?.close();
    });

    function request(method: string, path: string, body?: unknown, token = manager): Promise<Response> {
        return fetch(`${base}/api/v1/libraries${path}`, {
            method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    }

    it('authenticates reads and enforces library-management permission for every write', async () => {
        assert.equal((await request('GET', '', undefined, '')).status, 401);
        assert.equal((await request('GET', '', undefined, viewer)).status, 200);
        for (const method of ['PATCH', 'POST', 'DELETE']) {
            assert.equal((await request(method, method === 'PATCH' ? '/movies' : '/movies/paths', { path: '/media' }, viewer)).status, 403);
        }
        assert.equal(writes.length, 0);
    });

    it('rejects malformed bodies, invalid library types and invalid settings before persistence', async () => {
        for (const body of [[], null, true, 'string', {}]) assert.equal((await request('PATCH', '/movies', body)).status, 400);
        assert.equal((await request('PATCH', '/constructor', { movieIdentifiers: [] })).status, 400);
        assert.equal((await request('PATCH', '/movies', { movieIdentifiers: 'tmdb' })).status, 400);
        for (const path of [true, ['media'], '', '\u0000']) assert.equal((await request('POST', '/movies/paths', { path })).status, 400);
        assert.equal(writes.length, 0);
    });

    it('persists validated patches and directory changes, rejecting duplicates and absent paths', async () => {
        assert.equal((await request('PATCH', '/movies', { movieIdentifiers: [] })).status, 200);
        assert.deepEqual(current.movies.movieIdentifiers, []);
        const added = await request('POST', '/movies/paths', { path: '/media/movies' });
        assert.equal(added.status, 200);
        assert.deepEqual(await added.json(), [{ path: '/media/movies' }]);
        assert.deepEqual(await (await request('GET', '/movies')).json(), [{ path: '/media/movies' }]);
        assert.equal((await request('POST', '/movies/paths', { path: '/media/movies' })).status, 409);
        assert.equal((await request('DELETE', '/movies/paths', { path: '/absent' })).status, 404);
        assert.equal(writes.length, 2);
        assert.equal((await request('DELETE', '/movies/paths', { path: '/media/movies' })).status, 200);
        assert.deepEqual(current.movies.directories, []);
        assert.deepEqual(JSON.parse(writes.at(-1)!).movies.directories, []);
    });

    it('keeps active configuration intact when persistence fails and normalizes invalid error status codes', async () => {
        const before = structuredClone(current.movies);
        ConfigManager.updateConfig = async () => { throw { statusCode: 700, message: 'write failed' }; };
        const result = await request('PATCH', '/movies', { movieIdentifiers: [] });
        assert.equal(result.status, 500);
        assert.deepEqual(await result.json(), { code: 500, message: 'write failed' });
        assert.deepEqual(current.movies, before);
    });
});
