import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import {
    credentialStamp, issueAccessToken, issueJellyfinToken, verifyAccessToken, verifyJellyfinToken
} from '../../src/lib/auth/tokens.js';

describe('Access tokens', () => {
    const settings = { secret: 'token-spec-secret', tokenLifetimeDays: 30 };
    let sequelize: Sequelize;
    let user: User;

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        await sequelize.sync();
    });

    after(() => sequelize.close());

    beforeEach(async () => {
        await User.destroy({ where: {} });
        user = await User.create({ username: 'alice', name: 'Alice', email: 'a@example.com', password: 'hash-one', avatar: null });
    });

    describe('web tokens', () => {
        it('verifies a token it issued and exposes the user', async () => {
            const claims = await verifyAccessToken(issueAccessToken(user, settings), settings);

            assert.equal(claims?.id, user.id);
            assert.equal(claims?.username, 'alice');
        });

        it('expires after the configured lifetime', () => {
            const decoded = jwt.decode(issueAccessToken(user, { ...settings, tokenLifetimeDays: 2 })) as { iat: number; exp: number };

            assert.equal(decoded.exp - decoded.iat, 2 * 24 * 60 * 60);
        });

        it('rejects expired tokens', async () => {
            const expired = jwt.sign({ id: user.id, cs: credentialStamp(user.password), exp: Math.floor(Date.now() / 1000) - 10 }, settings.secret);

            assert.equal(await verifyAccessToken(expired, settings), null);
        });

        it('rejects tokens issued before a password change', async () => {
            const token = issueAccessToken(user, settings);

            await user.update({ password: 'hash-two' });
            assert.equal(await verifyAccessToken(token, settings), null);
        });

        it('rejects tokens for deleted users', async () => {
            const token = issueAccessToken(user, settings);

            await user.destroy();
            assert.equal(await verifyAccessToken(token, settings), null);
        });

        it('rejects tokens without a credential stamp, as issued by older versions', async () => {
            assert.equal(await verifyAccessToken(jwt.sign({ id: user.id }, settings.secret), settings), null);
        });

        it('rejects tokens signed with another secret, and non-strings', async () => {
            assert.equal(await verifyAccessToken(issueAccessToken(user, { secret: 'other' }), settings), null);
            assert.equal(await verifyAccessToken(undefined, settings), null);
            assert.equal(await verifyAccessToken('', settings), null);
        });
    });

    describe('Jellyfin tokens', () => {
        it('verifies a token it issued', async () => {
            const verified = await verifyJellyfinToken(issueJellyfinToken(user, settings.secret), settings.secret);

            assert.equal(verified?.id, user.id);
        });

        it('issues a different token per sign-in', () => {
            assert.notEqual(issueJellyfinToken(user, settings.secret), issueJellyfinToken(user, settings.secret));
        });

        it('rejects forged, tampered and malformed tokens', async () => {
            const token = issueJellyfinToken(user, settings.secret);
            const [, nonce, mac] = token.split('.');

            assert.equal(await verifyJellyfinToken(issueJellyfinToken(user, 'other'), settings.secret), null);
            assert.equal(await verifyJellyfinToken(`${(user.id + 1).toString(36)}.${nonce}.${mac}`, settings.secret), null);
            assert.equal(await verifyJellyfinToken(`${user.id.toString(36)}.${nonce}x.${mac}`, settings.secret), null);
            for (const bad of ['', 'abc', 'a.b', '0.b.c', '-1.b.c', 42, null]) assert.equal(await verifyJellyfinToken(bad, settings.secret), null);
        });

        it('dies with a password change', async () => {
            const token = issueJellyfinToken(user, settings.secret);

            await user.update({ password: null });
            assert.equal(await verifyJellyfinToken(token, settings.secret), null);
        });
    });
});
