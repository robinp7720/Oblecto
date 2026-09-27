/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import usersRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/users/index.js';
import displayPreferencesRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/displaypreferences/index.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { JellyfinDisplayPreferences, jellyfinDisplayPreferencesColumns } from '../../src/models/jellyfinDisplayPreferences.js';

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
    status(code: number) { this.statusCode = code; return this; },
    send(payload?: any) { this.body = payload; return this; }
});

describe('Jellyfin user settings', () => {
    let sequelize: Sequelize;
    let alice: User;
    let bob: User;
    const server = makeServer();
    const embyEmulation: any = { serverId: 'test-server-id', sessions: {}, oblecto: { config: {} } };

    const call = async (route: string, user: User, options: { query?: any; params?: any; body?: any } = {}) => {
        const res = makeRes();

        await server.handlers.get(route)({ query: options.query ?? {}, params: options.params ?? {}, body: options.body ?? {}, embyUserId: user.id }, res);
        return res;
    };

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        JellyfinDisplayPreferences.init(jellyfinDisplayPreferencesColumns, { sequelize, modelName: 'JellyfinDisplayPreferences' });
        await sequelize.sync({ force: true });

        alice = await User.create({ username: 'alice', name: 'Alice' });
        bob = await User.create({ username: 'bob', name: 'Bob' });

        usersRoutes(server as any, embyEmulation);
        displayPreferencesRoutes(server as any, embyEmulation);
    });

    after(async () => { await sequelize.close(); });

    describe('playback and subtitle settings', () => {
        it('saves what the app changed as the user\'s Oblecto preferences', async () => {
            const res = await call('POST /users/configuration', alice, {
                body: {
                    AudioLanguagePreference: '',
                    SubtitleLanguagePreference: 'eng',
                    SubtitleMode: 'OnlyForced',
                    EnableNextEpisodeAutoPlay: false,
                    // Jellyfin's own, which Oblecto does not keep
                    OrderedViews: ['movies'],
                    HidePlayedInLatest: false
                }
            });

            await alice.reload();
            assert.equal(res.statusCode, 204);
            assert.deepEqual(alice.preferences, {
                audioLanguage: null, subtitleLanguage: 'eng', subtitleMode: 'forced', autoplayNext: false
            });
        });

        it('shows the saved settings back to the app', async () => {
            const res = await call('GET /users/:userid', alice, { params: { userid: 'me' } });

            assert.equal(res.body.Configuration.SubtitleMode, 'OnlyForced');
            assert.equal(res.body.Configuration.SubtitleLanguagePreference, 'eng');
            assert.equal(res.body.Configuration.PlayDefaultAudioTrack, true);
            assert.equal(res.body.Configuration.EnableNextEpisodeAutoPlay, false);
        });

        it('treats the subtitle modes Oblecto has no match for as following the file', async () => {
            await call('POST /users/:userid/configuration', alice, { params: { userid: 'me' }, body: { SubtitleMode: 'Smart' } });
            await alice.reload();

            assert.equal(alice.preferences?.subtitleMode, 'auto');
            // Everything else stays as it was
            assert.equal(alice.preferences?.subtitleLanguage, 'eng');
        });

        it('refuses a value Oblecto cannot keep, and keeps nothing of that change', async () => {
            const res = await call('POST /users/configuration', alice, { body: { SubtitleLanguagePreference: 'not a language!', EnableNextEpisodeAutoPlay: true } });

            await alice.reload();
            assert.equal(res.statusCode, 400);
            assert.match(res.body, /subtitleLanguage/);
            assert.equal(alice.preferences?.autoplayNext, false);
        });
    });

    describe('display preferences', () => {
        const home = { SortBy: 'DateCreated', CustomPrefs: { homesection0: 'resume', homesection1: 'nextup' } };

        it('answers Jellyfin\'s defaults before anything is saved', async () => {
            const res = await call('GET /displaypreferences/:displaypreferencesid', alice, { params: { displaypreferencesid: 'usersettings' }, query: { client: 'emby' } });

            assert.equal(res.body.Id, 'usersettings');
            assert.equal(res.body.SortBy, 'SortName');
            assert.equal(res.body.CustomPrefs.skipForwardLength, '30000');
        });

        it('keeps them per user and per app', async () => {
            const params = { displaypreferencesid: 'usersettings' };
            const saved = await call('POST /displaypreferences/:displaypreferencesid', alice, { params, query: { client: 'emby' }, body: home });
            const back = await call('GET /displaypreferences/:displaypreferencesid', alice, { params, query: { client: 'emby' } });
            const otherApp = await call('GET /displaypreferences/:displaypreferencesid', alice, { params, query: { client: 'other' } });
            const otherUser = await call('GET /displaypreferences/:displaypreferencesid', bob, { params, query: { client: 'emby' } });

            assert.equal(saved.statusCode, 204);
            assert.equal(back.body.SortBy, 'DateCreated');
            assert.deepEqual(back.body.CustomPrefs, home.CustomPrefs);
            assert.equal(otherApp.body.SortBy, 'SortName');
            assert.equal(otherUser.body.SortBy, 'SortName');
        });

        it('replaces them when saved again, and refuses what is not preferences', async () => {
            const params = { displaypreferencesid: 'usersettings' };

            await call('POST /displaypreferences/:displaypreferencesid', alice, { params, query: { client: 'emby' }, body: { ...home, SortBy: 'Random' } });
            const back = await call('GET /displaypreferences/:displaypreferencesid', alice, { params, query: { client: 'emby' } });
            const huge = await call('POST /displaypreferences/:displaypreferencesid', alice, { params, body: { CustomPrefs: { big: 'x'.repeat(70 * 1024) } } });

            assert.equal(back.body.SortBy, 'Random');
            assert.equal(await JellyfinDisplayPreferences.count(), 1);
            assert.equal(huge.statusCode, 413);
        });
    });
});
