/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sequelize } from 'sequelize';
import systemRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/system/index.js';
import brandingRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/branding/index.js';
import EmbyEmulation from '../../src/lib/embyEmulation/index.js';
import { ConfigManager } from '../../src/config.js';
import { ConfigWriter } from '../../src/lib/settings/ConfigWriter.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import defaults from '../../res/config.json';

const makeServer = () => {
    const handlers = new Map<string, any>();
    const register = (method: string) => (route: string, handler: any) => { handlers.set(`${method} ${route}`, handler); };

    return {
        handlers, get: register('GET'), post: register('POST'), put: register('PUT'), delete: register('DELETE')
    };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    contentType: '',
    status(code: number) { this.statusCode = code; return this; },
    send(payload?: any) { this.body = payload; return this; },
    type(value: string) { this.contentType = value; return this; }
});

describe('Jellyfin server settings', () => {
    let sequelize: Sequelize;
    let admin: User;
    let viewer: User;
    let directory: string;
    let file: string;
    const original = ConfigManager.updateConfig;
    const server = makeServer();
    const config: any = structuredClone(defaults);
    // Only what these routes read; getters come from the real class
    const embyEmulation = Object.create(EmbyEmulation.prototype, { oblecto: { value: { config } } });

    const call = async (route: string, user: User, body: any = {}) => {
        const res = makeRes();

        await server.handlers.get(route)({ query: {}, params: {}, body, embyUserId: user.id }, res);
        return res;
    };

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        await sequelize.sync({ force: true });

        const admins = await Group.create({ name: 'Administrators', permissions: ['settings.manage'] });
        const users = await Group.create({ name: 'Users', permissions: [] });

        admin = await User.create({ username: 'admin', groupId: admins.id });
        viewer = await User.create({ username: 'viewer', groupId: users.id });

        // Saved settings go to a scratch copy, never to a real configuration
        directory = await mkdtemp(join(tmpdir(), 'oblecto-jellyfin-settings-'));
        file = join(directory, 'config.json');
        await writeFile(file, JSON.stringify(config));
        const writer = new ConfigWriter(() => file);

        ConfigManager.updateConfig = (change, current) => writer.update(current!, change);

        systemRoutes(server as any, embyEmulation);
        brandingRoutes(server as any, embyEmulation);
    });

    after(async () => {
        ConfigManager.updateConfig = original;
        await rm(directory, { recursive: true, force: true });
        await sequelize.close();
    });

    const saved = async (): Promise<any> => JSON.parse(await readFile(file, 'utf8'));

    it('shows the server name and resume thresholds Oblecto uses', async () => {
        const res = await call('GET /system/configuration', viewer);

        assert.equal(res.body.ServerName, 'Oblecto');
        assert.equal(res.body.MinResumePct, 0);
        assert.equal(res.body.MaxResumePct, 90);
    });

    it('shows the hardware encoder Oblecto is set to use', async () => {
        config.transcoding = { hardwareAcceleration: true, hardwareAccelerator: 'vaapi' };
        const vaapi = await call('GET /system/configuration/encoding', viewer);

        config.transcoding = { hardwareAcceleration: false, hardwareAccelerator: 'cuda' };
        const none = await call('GET /system/configuration/encoding', viewer);

        assert.equal(vaapi.body.HardwareAccelerationType, 'vaapi');
        assert.equal(vaapi.body.EnableHardwareEncoding, true);
        assert.equal(none.body.HardwareAccelerationType, 'none');
    });

    it('lets only administrators change settings', async () => {
        const res = await call('POST /system/configuration', viewer, { ServerName: 'Mine now' });

        assert.equal(res.statusCode, 403);
        assert.equal(config.jellyfin.serverName, 'Oblecto');
    });

    it('saves the server name an administrator sets, and ignores what Oblecto does not keep', async () => {
        const res = await call('POST /system/configuration', admin, { ServerName: '  Living room  ', MinResumePct: 50, LogFileRetentionDays: 1 });

        assert.equal(res.statusCode, 204);
        assert.equal(config.jellyfin.serverName, 'Living room');
        assert.equal(embyEmulation.serverName, 'Living room');
        assert.equal((await saved()).jellyfin.serverName, 'Living room');
        assert.equal((await call('GET /system/configuration', viewer)).body.MaxResumePct, 90);
    });

    it('refuses a blank server name', async () => {
        const res = await call('POST /system/configuration', admin, { ServerName: '   ' });

        assert.equal(res.statusCode, 400);
        assert.equal(config.jellyfin.serverName, 'Living room');
    });

    it('saves the hardware encoder, and refuses one Oblecto cannot use', async () => {
        const nvenc = await call('POST /system/configuration/encoding', admin, { HardwareAccelerationType: 'nvenc', EnableHardwareEncoding: true, EncodingThreadCount: 4 });

        assert.equal(nvenc.statusCode, 204);
        assert.deepEqual(config.transcoding, { hardwareAcceleration: true, hardwareAccelerator: 'cuda' });

        const qsv = await call('POST /system/configuration/encoding', admin, { HardwareAccelerationType: 'qsv' });

        assert.equal(qsv.statusCode, 400);
        assert.equal(config.transcoding.hardwareAccelerator, 'cuda');

        await call('POST /system/configuration/encoding', admin, { HardwareAccelerationType: 'none' });
        assert.equal(config.transcoding.hardwareAcceleration, false);
    });

    it('saves and serves the sign-in disclaimer and custom CSS', async () => {
        const res = await call('POST /system/configuration/branding', admin, { LoginDisclaimer: 'Family only.', CustomCss: 'body { color: red; }' });
        const branding = await call('GET /branding/configuration', viewer);
        const css = await call('GET /branding/css', viewer);
        const tooLong = await call('POST /system/configuration/branding', admin, { LoginDisclaimer: 'x'.repeat(1001) });

        assert.equal(res.statusCode, 204);
        assert.equal(branding.body.LoginDisclaimer, 'Family only.');
        assert.equal(css.contentType, 'text/css');
        assert.equal(css.body, 'body { color: red; }');
        assert.equal(tooLong.statusCode, 400);
        assert.equal((await saved()).jellyfin.loginDisclaimer, 'Family only.');
    });

    it('answers only the configuration sections it has', async () => {
        assert.equal((await call('GET /system/configuration/:key', viewer)).statusCode, 404);
    });
});
