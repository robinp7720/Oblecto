/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import sharp from 'sharp';
import { Sequelize } from 'sequelize';
import config from '../../src/config.js';
import accountRoutes from '../../src/submodules/REST/routes/v1/account.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { DEFAULT_GROUP, seedGroups } from '../../src/lib/auth/permissions.js';
import { DEFAULT_PREFERENCES } from '../../src/lib/users/preferences.js';

describe('account self-service', () => {
    let sequelize: Sequelize;
    let server: Server;
    let base: string;
    let avatarDir: string;
    let user: User;
    const oblecto: any = { config: { authentication: { secret: config.authentication.secret, saltRounds: 4 }, assets: {} } };

    const request = async (method: string, route: string, init: { json?: object; form?: FormData; as?: User } = {}) => {
        // Re-read the user so tokens match a password changed earlier in the test.
        const signedIn = await User.findByPk((init.as ?? user).id);
        const headers: Record<string, string> = { Authorization: `Bearer ${issueAccessToken(signedIn ?? (init.as ?? user), config.authentication)}` };
        let body: BodyInit | undefined;

        if (init.json) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(init.json);
        } else if (init.form) {
            body = init.form;
        }

        const response = await fetch(base + route, {
            method, headers, body
        });

        return { status: response.status, body: await response.json() };
    };

    const upload = (data: Buffer, name: string) => {
        const form = new FormData();

        form.append('avatar', new Blob([new Uint8Array(data)]), name);
        return form;
    };

    before(async () => {
        avatarDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-avatars-'));
        oblecto.config.assets.userAvatarLocation = avatarDir;

        sequelize = new Sequelize({
            dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false
        });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        await sequelize.sync();
        await seedGroups();

        const app = express();

        app.use((req: any, res: Response, next: NextFunction) => {
            const [scheme, credentials] = (req.headers.authorization ?? '').split(' ');

            if (credentials) req.authorization = { scheme, credentials };
            next();
        });
        app.use(express.json());
        accountRoutes(app, oblecto);
        app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            res.status((err.statusCode as number) || 500).json({ message: err.message });
        });

        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(async () => {
        server.close();
        await sequelize.close();
        await fs.rm(avatarDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        await User.destroy({ where: {} });
        const users = await Group.findOne({ where: { name: DEFAULT_GROUP } });

        user = await User.create({
            username: 'bob', name: 'Bob', email: 'bob@example.com', password: await bcrypt.hash('hunter2', 4), avatar: null, groupId: users!.id
        });
    });

    it('describes the signed-in user without the password hash', async () => {
        const { status, body } = await request('GET', '/api/v1/me');

        assert.equal(status, 200);
        assert.equal(body.username, 'bob');
        assert.equal(body.password, undefined);
        assert.equal(body.hasPassword, true);
        assert.deepEqual(body.group, { id: user.groupId, name: DEFAULT_GROUP });
        assert.deepEqual(body.permissions, []);
        assert.deepEqual(body.preferences, DEFAULT_PREFERENCES);
    });

    it('requires a session', async () => {
        const response = await fetch(`${base}/api/v1/me`);

        assert.equal(response.status, 401);
    });

    it('updates name, email and preferences but nothing an admin controls', async () => {
        const { status, body } = await request('PATCH', '/api/v1/me', {
            json: {
                name: 'Robert',
                email: ' ',
                username: 'root',
                groupId: 1,
                passwordlessLocal: true,
                preferences: {
                    language: 'nl', subtitleMode: 'forced', quality: 720
                }
            }
        });

        assert.equal(status, 200);
        assert.equal(body.name, 'Robert');
        assert.equal(body.email, null);
        assert.equal(body.username, 'bob');
        assert.equal(body.passwordlessLocal, false);

        const stored = (await User.findByPk(user.id))!;

        assert.equal(stored.groupId, user.groupId);
        assert.deepEqual(stored.preferences, {
            language: 'nl', subtitleMode: 'forced', quality: 720
        });
    });

    it('merges preference updates', async () => {
        await request('PATCH', '/api/v1/me', { json: { preferences: { audioLanguage: 'jpn' } } });
        const { body } = await request('PATCH', '/api/v1/me', { json: { preferences: { autoplayNext: false } } });

        assert.equal(body.preferences.audioLanguage, 'jpn');
        assert.equal(body.preferences.autoplayNext, false);
        assert.equal(body.preferences.subtitleMode, 'auto');
    });

    it('rejects unknown or invalid preferences and stores none of them', async () => {
        const invalid = {
            theme: 'dark', quality: 4000, language: 'nl'
        };
        const { status, body } = await request('PATCH', '/api/v1/me', { json: { preferences: invalid } });

        assert.equal(status, 400);
        assert.deepEqual(Object.keys(body.fields as object).sort(), ['quality', 'theme']);
        assert.equal((await User.findByPk(user.id))!.preferences, null);
    });

    it('changes the password only with the current one', async () => {
        assert.equal((await request('PUT', '/api/v1/me/password', { json: { currentPassword: 'wrong', newPassword: 'secret' } })).status, 403);
        assert.equal((await request('PUT', '/api/v1/me/password', { json: { newPassword: 'secret' } })).status, 403);
        assert.equal((await request('PUT', '/api/v1/me/password', { json: { currentPassword: 'hunter2', newPassword: 'x' } })).status, 400);
        assert.equal((await request('PUT', '/api/v1/me/password', { json: { currentPassword: 'hunter2', newPassword: 'secret' } })).status, 200);

        assert.ok(await bcrypt.compare('secret', (await User.findByPk(user.id))!.password!));
    });

    it('lets an account without a password set one', async () => {
        await user.update({ password: null });

        const { status, body } = await request('PUT', '/api/v1/me/password', { json: { newPassword: 'secret' } });

        assert.equal(status, 200);
        assert.equal(body.hasPassword, true);
    });

    it('uploads and removes an avatar', async () => {
        const png = await sharp({
            create: {
                width: 400, height: 300, channels: 3, background: '#336699'
            }
        }).png().toBuffer();

        const uploaded = await request('PUT', '/api/v1/me/avatar', { form: upload(png, 'me.png') });

        assert.equal(uploaded.status, 200);
        assert.match(uploaded.body.avatar as string, new RegExp(`^${user.id}-\\d+\\.webp$`));

        const file = path.join(avatarDir, uploaded.body.avatar as string);
        const metadata = await sharp(file).metadata();

        assert.equal(metadata.width, 256);
        assert.equal(metadata.height, 256);

        const removed = await request('DELETE', '/api/v1/me/avatar');

        assert.equal(removed.body.avatar, null);
        await assert.rejects(fs.access(file));
    });

    it('refuses files that are not images', async () => {
        const { status } = await request('PUT', '/api/v1/me/avatar', { form: upload(Buffer.from('not an image'), 'me.png') });

        assert.equal(status, 422);
        assert.equal((await User.findByPk(user.id))!.avatar, null);
    });

    it('asks for a file when none was sent', async () => {
        const { status } = await request('PUT', '/api/v1/me/avatar', { form: new FormData() });

        assert.equal(status, 400);
    });
});
