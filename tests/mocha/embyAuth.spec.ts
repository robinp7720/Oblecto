/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize';
import EmbyEmulation from '../../src/lib/embyEmulation/index.js';
import { pinToUser, isPublicRoute } from '../../src/lib/embyEmulation/ServerAPI/sessionGuard.js';
import type { EmbyRequest } from '../../src/lib/embyEmulation/ServerAPI/index.js';
import { formatUuid } from '../../src/lib/embyEmulation/helpers.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { saveProgress } from '../../src/lib/playback/progress.js';
import { formatId } from '../../src/lib/embyEmulation/helpers.js';

const AUTH = (token?: string) => ({
    'X-Emby-Authorization': `MediaBrowser Client="Spec", Device="Mocha", DeviceId="spec-device", Version="1.0"${token ? `, Token="${token}"` : ''}`
});

describe('Jellyfin emulation sign-in and sessions', function () {
    let sequelize: Sequelize;
    let alice: User;
    let bob: User;
    const servers: EmbyEmulation[] = [];

    const oblecto = () => ({
        config: {
            authentication: { secret: 'jellyfin-spec-secret', saltRounds: 4, allowPasswordlessLogin: false },
            jellyfin: { enabled: true, port: 0, host: '127.0.0.1' },
            assets: {}
        },
        version: '1.0.0'
    });

    const start = async (): Promise<{ emby: EmbyEmulation; base: string }> => {
        const emby = new EmbyEmulation(oblecto() as any);

        servers.push(emby);
        if (!emby.serverAPI.server.listening) await once(emby.serverAPI.server, 'listening');

        return { emby, base: `http://127.0.0.1:${(emby.serverAPI.server.address() as AddressInfo).port}` };
    };

    const signIn = async (base: string, Username: string, Pw: string) => fetch(`${base}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: { ...AUTH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ Username, Pw })
    });

    const tokenFor = async (base: string, username = 'alice', password = 'alice-pw'): Promise<string> =>
        ((await (await signIn(base, username, password)).json()) as { AccessToken: string }).AccessToken;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        if (!Episode.associations.Series) Episode.belongsTo(Series);
        if (!Episode.associations.TrackEpisodes) Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        if (!Episode.associations.Files) Episode.belongsToMany(File, { through: 'EpisodeFiles' });
        // Other specs associate these model classes too; reuse theirs rather than declare a second alias.
        if (!TrackMovie.associations.Movie) TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });
        if (!Movie.associations.TrackMovies) Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });
        if (!Movie.associations.Files) Movie.belongsToMany(File, { through: 'MovieFiles' });
        if (!File.associations.Movies) File.belongsToMany(Movie, { through: 'MovieFiles' });
        if (!File.associations.Streams) File.hasMany(Stream);
        if (!Stream.associations.File) Stream.belongsTo(File);
        await sequelize.sync({ force: true });

        alice = await User.create({ username: 'alice', name: 'Alice', email: null, password: await bcrypt.hash('alice-pw', 4), avatar: null });
        bob = await User.create({ username: 'bob', name: 'Bob', email: null, password: await bcrypt.hash('bob-pw', 4), avatar: null });
        await Movie.create({ movieName: 'Recent' } as any);
    });

    after(async () => {
        await Promise.all(servers.map(server => server.close()));
        await sequelize.close();
    });

    it('answers discovery and sign-in without a token', async () => {
        const { emby, base } = await start();
        const info = await fetch(`${base}/System/Info/Public`);

        assert.equal(info.status, 200);
        const body = await info.json() as { Id: string; Version: string; LocalAddress: string };

        assert.equal(body.Id, emby.serverId);
        assert.match(body.Version, /^\d+\.\d+\.\d+$/);
        assert.equal(body.LocalAddress, base);
    });

    it('refuses the library, user list and user data without a token', async () => {
        const { base } = await start();

        for (const path of ['/Users', '/Items', `/Users/${formatUuid(alice.id)}/Items`, '/Shows/NextUp', '/Search/Hints', '/System/Info', '/Items/Latest'])
            assert.equal((await fetch(base + path)).status, 401, path);
    });

    it('rejects a wrong password with 401', async () => {
        const { base } = await start();

        assert.equal((await signIn(base, 'alice', 'nope')).status, 401);
        assert.equal((await signIn(base, 'nobody', 'nope')).status, 401);
    });

    it('signs in and reports the real user, device and server', async () => {
        const { emby, base } = await start();
        const response = await signIn(base, 'alice', 'alice-pw');
        const body = await response.json() as any;

        assert.equal(response.status, 200);
        assert.equal(body.User.Id, formatUuid(alice.id));
        assert.equal(body.User.Name, 'Alice');
        assert.equal(body.ServerId, emby.serverId);
        assert.equal(body.SessionInfo.Client, 'Spec');
        assert.equal(body.SessionInfo.DeviceName, 'Mocha');
        assert.ok(body.AccessToken);
    });

    it('answers /Users/{id} and /Users/Me with the signed-in user, whatever id is asked for', async () => {
        const { base } = await start();
        const token = await tokenFor(base);

        for (const path of [`/Users/${formatUuid(bob.id)}`, '/Users/Me']) {
            const response = await fetch(base + path, { headers: AUTH(token) });

            assert.equal(response.status, 200, path);
            assert.equal(((await response.json()) as { Id: string }).Id, formatUuid(alice.id), path);
        }
    });

    it('accepts the token in the headers and query forms clients use', async () => {
        const { base } = await start();
        const token = await tokenFor(base);

        assert.equal((await fetch(`${base}/System/Info`, { headers: { 'X-Emby-Token': token } })).status, 200);
        assert.equal((await fetch(`${base}/System/Info?api_key=${token}`)).status, 200);
        assert.equal((await fetch(`${base}/System/Info`, { headers: { Authorization: `MediaBrowser Token="${token}"` } })).status, 200);
    });

    it('keeps tokens working across a restart', async () => {
        const first = await start();
        const token = await tokenFor(first.base);
        const second = await start();

        assert.equal(second.emby.serverId, first.emby.serverId);
        assert.equal((await fetch(`${second.base}/System/Info`, { headers: AUTH(token) })).status, 200);
    });

    it('rejects tokens after the password changes', async () => {
        const { base } = await start();
        const token = await tokenFor(base, 'bob', 'bob-pw');

        await bob.update({ password: await bcrypt.hash('bob-new', 4) });

        const fresh = await start();

        assert.equal((await fetch(`${fresh.base}/System/Info`, { headers: AUTH(token) })).status, 401);
    });

    it('rejects a token after the client signs out', async () => {
        const { base } = await start();
        const token = await tokenFor(base);

        assert.equal((await fetch(`${base}/Sessions/Logout`, { method: 'POST', headers: AUTH(token) })).status, 204);
        assert.equal((await fetch(`${base}/System/Info`, { headers: AUTH(token) })).status, 401);
    });

    it('answers latest items for every library view instead of hanging', async () => {
        const { base } = await start();
        const token = await tokenFor(base);

        for (const parent of ['movies', 'shows', 'collections', 'f137a2dd21bbc1b99aa5c0f6bf02a805']) {
            const response = await fetch(`${base}/Users/${formatUuid(alice.id)}/Items/Latest?ParentId=${parent}`, { headers: AUTH(token), signal: AbortSignal.timeout(5000) });

            assert.equal(response.status, 200, parent);
            assert.ok(Array.isArray(await response.json()), parent);
        }

        const movies = await (await fetch(`${base}/Items/Latest?ParentId=movies`, { headers: AUTH(token) })).json() as { Name: string }[];

        assert.deepEqual(movies.map(movie => movie.Name), ['Recent']);
    });

    it('lists the same library views from both view endpoints', async () => {
        const { base } = await start();
        const token = await tokenFor(base);
        const ids = async (path: string) => ((await (await fetch(base + path, { headers: AUTH(token) })).json()) as { Items: { Id: string }[] }).Items.map(item => item.Id);

        assert.deepEqual(await ids(`/Users/${formatUuid(alice.id)}/Views`), await ids('/UserViews'));
        assert.deepEqual(await ids('/UserViews'), ['movies', 'shows', 'collections']);
    });

    describe('user data', function () {
        let base: string;
        let token: string;
        let movie: Movie;

        before(async () => {
            ({ base } = await start());
            token = await tokenFor(base);
            movie = await Movie.create({ movieName: 'Half watched' } as any);
        });

        it('marks a movie played and unplayed, and reports it', async () => {
            const id = formatId(movie.id, 'movie');
            const marked = await fetch(`${base}/UserPlayedItems/${id}`, { method: 'POST', headers: AUTH(token) });

            assert.equal(marked.status, 200);
            assert.equal(((await marked.json()) as { Played: boolean }).Played, true);
            assert.equal(((await (await fetch(`${base}/UserItems/${id}/UserData`, { headers: AUTH(token) })).json()) as { Played: boolean }).Played, true);

            await fetch(`${base}/Users/${formatUuid(alice.id)}/PlayedItems/${id}`, { method: 'DELETE', headers: AUTH(token) });
            assert.equal(((await (await fetch(`${base}/UserItems/${id}/UserData`, { headers: AUTH(token) })).json()) as { Played: boolean }).Played, false);
        });

        it('lists started, unfinished items to resume, for the signed-in user only', async () => {
            await saveProgress(alice.id, 'movie', movie.id, 600, 1200);
            await saveProgress(bob.id, 'movie', movie.id, 60, 1200);

            const resume = await (await fetch(`${base}/Users/${formatUuid(alice.id)}/Items/Resume`, { headers: AUTH(token) })).json() as { Items: { Name: string; UserData: { PlaybackPositionTicks: number } }[] };

            assert.deepEqual(resume.Items.map(item => item.Name), ['Half watched']);
            assert.equal(resume.Items[0].UserData.PlaybackPositionTicks, 600 * 10000000);
        });

        it('says favourites and ratings are unsupported instead of pretending to keep them', async () => {
            const id = formatId(movie.id, 'movie');

            assert.equal((await fetch(`${base}/UserFavoriteItems/${id}`, { method: 'POST', headers: AUTH(token) })).status, 501);
            assert.equal((await fetch(`${base}/UserItems/${id}/Rating`, { method: 'POST', headers: AUTH(token) })).status, 501);
        });

        it('changes the password, checking the current one', async () => {
            const change = (CurrentPw: string, NewPw: string) => fetch(`${base}/Users/${formatUuid(alice.id)}/Password`, {
                method: 'POST',
                headers: { ...AUTH(token), 'Content-Type': 'application/json' },
                body: JSON.stringify({ CurrentPw, NewPw })
            });

            assert.equal((await change('wrong', 'alice-new-pw')).status, 403);
            assert.equal((await change('alice-pw', 'alice-new-pw')).status, 204);
            assert.equal((await signIn(base, 'alice', 'alice-new-pw')).status, 200);

            // Back again for the other tests
            const fresh = await start();

            assert.equal((await fetch(`${fresh.base}/System/Info`, { headers: AUTH(token) })).status, 401, 'old token rejected after a password change');
            await alice.reload();
            await alice.update({ password: await bcrypt.hash('alice-pw', 4) });
        });
    });

    describe('pinToUser', function () {
        const request = (url: string, body?: object) => ({ url, body }) as unknown as EmbyRequest;

        it('rewrites the user path segment, dashed or not', function () {
            for (const other of [formatUuid(99), formatUuid(99).replace(/-/g, '')]) {
                const req = request(`/users/${other}/items?parentid=shows`);

                pinToUser(req, 7);
                assert.equal(req.url, `/users/${formatUuid(7)}/items?parentid=shows`);
            }
        });

        it('rewrites UserId in the query and the body, in any casing', function () {
            const req = request('/items?UserId=abc&userid=def&Limit=5', { UserId: 'abc', Other: 1 });

            pinToUser(req, 7);
            const params = new URLSearchParams(req.url.split('?')[1]);

            assert.equal(params.get('UserId'), formatUuid(7));
            assert.equal(params.get('userid'), formatUuid(7));
            assert.equal(params.get('Limit'), '5');
            assert.deepEqual(req.body, { UserId: formatUuid(7), Other: 1 });
        });

        it('leaves named user routes alone', function () {
            const req = request('/users/me');

            pinToUser(req, 7);
            assert.equal(req.url, '/users/me');
        });
    });

    it('keeps only pre-sign-in routes public', function () {
        for (const path of ['/system/info/public', '/users/authenticatebyname', '/users/public', `/items/${'1'.repeat(32)}/images/primary`, '/branding/configuration', '/web/index.html', '/playback/media/a/1/master.m3u8'])
            assert.ok(isPublicRoute(path), path);
        for (const path of ['/users', '/users/me', '/items', '/system/info', '/items/latest', '/sessions/playing'])
            assert.ok(!isPublicRoute(path), path);
    });
});
