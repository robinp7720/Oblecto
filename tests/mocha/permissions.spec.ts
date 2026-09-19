/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import express, { NextFunction, Request, Response } from 'express';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import { Sequelize } from 'sequelize';
import config from '../../src/config.js';
import userRoutes from '../../src/submodules/REST/routes/users.js';
import groupRoutes from '../../src/submodules/REST/routes/v1/groups.js';
import settingsRoutes from '../../src/submodules/REST/routes/v1/settings.js';
import systemRoutes from '../../src/submodules/REST/routes/v1/system.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { ADMIN_GROUP, DEFAULT_GROUP, seedGroups } from '../../src/lib/auth/permissions.js';

describe('groups and permissions', () => {
    let sequelize: Sequelize;
    let server: Server;
    let base: string;
    let admins: Group;
    let users: Group;
    const oblecto: any = {
        config: { authentication: { secret: config.authentication.secret, saltRounds: 4 }, assets: {} },
        queue: { maintenance: { list: () => [] } }
    };

    const tokenFor = (user: User) => issueAccessToken(user, config.authentication);

    const call = async (method: string, path: string, user?: User, body?: object) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;

        const response = await fetch(base + path, {
            method, headers, body: body ? JSON.stringify(body) : undefined
        });

        return { status: response.status, body: await response.json() };
    };

    const createUser = (username: string, group: Group | null) => User.create({
        username, name: username, email: `${username}@example.com`, password: null, avatar: null, groupId: group?.id ?? null
    });

    before(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false
        });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Group.init(groupColumns, { sequelize, modelName: 'Group' });
        await sequelize.sync();

        const app = express();

        app.use((req: any, res: Response, next: NextFunction) => {
            const [scheme, credentials] = (req.headers.authorization ?? '').split(' ');

            if (credentials) req.authorization = { scheme, credentials };
            next();
        });
        app.use(express.json());
        app.use((req: any, res: Response, next: NextFunction) => {
            req.combined_params = { ...req.query, ...req.body };
            next();
        });
        userRoutes(app, oblecto);
        groupRoutes(app, oblecto);
        settingsRoutes(app, oblecto);
        systemRoutes(app, oblecto);
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
    });

    beforeEach(async () => {
        await User.destroy({ where: {} });
        await Group.destroy({ where: {} });
        await seedGroups();
        admins = (await Group.findOne({ where: { name: ADMIN_GROUP } }))!;
        users = (await Group.findOne({ where: { name: DEFAULT_GROUP } }))!;
    });

    describe('seeding', () => {
        it('creates the built-in groups once', async () => {
            await seedGroups();

            assert.equal(await Group.count(), 2);
            assert.ok(admins.builtIn && users.builtIn);
            assert.deepEqual(users.permissions, []);
            assert.ok(admins.permissions.includes('settings.manage'));
            assert.ok(admins.permissions.includes('users.manage'));
        });
    });

    describe('route gating', () => {
        it('rejects requests without a token', async () => {
            assert.equal((await call('GET', '/api/v1/settings')).status, 401);
        });

        it('forbids users without the permission', async () => {
            const bob = await createUser('bob', users);

            assert.equal((await call('GET', '/api/v1/settings', bob)).status, 403);
            assert.equal((await call('GET', '/api/v1/system/maintenance/jobs', bob)).status, 403);
            assert.equal((await call('GET', '/users', bob)).status, 403);
            assert.equal((await call('POST', '/user', bob, {
 username: 'eve', name: 'Eve', email: 'e@x' 
})).status, 403);
        });

        it('treats a user without a group as having no permissions', async () => {
            const loner = await createUser('loner', null);

            assert.equal((await call('GET', '/api/v1/settings', loner)).status, 403);
        });

        it('lets administrators through', async () => {
            const alice = await createUser('alice', admins);

            assert.equal((await call('GET', '/api/v1/settings', alice)).status, 200);
            assert.equal((await call('GET', '/api/v1/system/maintenance/jobs', alice)).status, 200);
            assert.equal((await call('GET', '/users', alice)).status, 200);
        });

        it('grants exactly what a custom group allows', async () => {
            const operators = await Group.create({ name: 'Operators', permissions: ['system.manage'] });
            const olivia = await createUser('olivia', operators);

            assert.equal((await call('GET', '/api/v1/system/maintenance/jobs', olivia)).status, 200);
            assert.equal((await call('GET', '/api/v1/settings', olivia)).status, 403);
        });

        it('applies a demotion to a token issued before it', async () => {
            const alice = await createUser('alice', admins);
            await createUser('root', admins);

            assert.equal((await call('GET', '/api/v1/settings', alice)).status, 200);
            await alice.update({ groupId: users.id });
            assert.equal((await call('GET', '/api/v1/settings', alice)).status, 403);
        });

        it('lets users read their own record but not anyone else\'s', async () => {
            const bob = await createUser('bob', users);
            const carol = await createUser('carol', users);

            assert.equal((await call('GET', `/user/${bob.id}`, bob)).status, 200);
            assert.equal((await call('GET', `/user/${carol.id}`, bob)).status, 403);
            assert.equal((await call('PUT', `/user/${bob.id}`, bob, { groupId: admins.id })).status, 403);
        });

        it('rejects tokens for users that were deleted', async () => {
            const ghost = await createUser('ghost', admins);

            await ghost.destroy();
            assert.equal((await call('GET', '/api/v1/settings', ghost)).status, 401);
        });
    });

    describe('user management', () => {
        it('puts new users in the default group unless told otherwise', async () => {
            const alice = await createUser('alice', admins);

            const plain = await call('POST', '/user', alice, {
 username: 'dave', name: 'Dave', email: 'd@x' 
});
            const promoted = await call('POST', '/user', alice, {
                username: 'erin', name: 'Erin', email: 'e@x', groupId: admins.id
            });

            assert.equal(plain.body.groupId, users.id);
            assert.equal(promoted.body.groupId, admins.id);
        });

        it('moves users between groups', async () => {
            const alice = await createUser('alice', admins);
            const bob = await createUser('bob', users);

            const moved = await call('PUT', `/user/${bob.id}`, alice, { groupId: admins.id });

            assert.equal(moved.status, 200);
            assert.equal(moved.body.groupId, admins.id);
        });

        it('rejects unknown groups', async () => {
            const alice = await createUser('alice', admins);
            const bob = await createUser('bob', users);

            assert.equal((await call('PUT', `/user/${bob.id}`, alice, { groupId: 9999 })).status, 400);
        });

        it('will not demote or delete the last administrator', async () => {
            const alice = await createUser('alice', admins);

            assert.equal((await call('PUT', `/user/${alice.id}`, alice, { groupId: users.id })).status, 409);
            assert.equal((await call('DELETE', `/user/${alice.id}`, alice)).status, 409);
            assert.equal((await User.findByPk(alice.id))!.groupId, admins.id);
        });

        it('allows it while another administrator remains', async () => {
            const alice = await createUser('alice', admins);
            await createUser('root', admins);

            assert.equal((await call('PUT', `/user/${alice.id}`, alice, { groupId: users.id })).status, 200);
        });
    });

    describe('group management', () => {
        it('lists the permissions a group can grant', async () => {
            const alice = await createUser('alice', admins);
            const { body } = await call('GET', '/api/v1/permissions', alice);

            assert.deepEqual(body.map((permission: any) => permission.key).sort(), ['libraries.manage', 'settings.manage', 'system.manage', 'users.manage']);
        });

        it('creates, edits and deletes groups', async () => {
            const alice = await createUser('alice', admins);

            const created = await call('POST', '/api/v1/groups', alice, { name: 'Family', permissions: ['libraries.manage'] });

            assert.equal(created.status, 200);
            assert.deepEqual(created.body.permissions, ['libraries.manage']);

            const bob = await createUser('bob', (await Group.findByPk(created.body.id as number)));

            const edited = await call('PATCH', `/api/v1/groups/${created.body.id}`, alice, { name: 'Household', permissions: [] });

            assert.equal(edited.body.name, 'Household');
            assert.deepEqual(edited.body.permissions, []);
            assert.equal(edited.body.members, 1);

            assert.equal((await call('DELETE', `/api/v1/groups/${created.body.id}`, alice)).status, 200);
            assert.equal((await User.findByPk(bob.id))!.groupId, users.id);
        });

        it('lists groups with member counts', async () => {
            const alice = await createUser('alice', admins);
            await createUser('bob', users);
            await createUser('carol', users);

            const { body } = await call('GET', '/api/v1/groups', alice);

            assert.deepEqual(body.map((group: any) => [group.name, group.members]), [[ADMIN_GROUP, 1], [DEFAULT_GROUP, 2]]);
        });

        it('validates names and permissions', async () => {
            const alice = await createUser('alice', admins);

            assert.equal((await call('POST', '/api/v1/groups', alice, { name: ' ' })).status, 400);
            assert.equal((await call('POST', '/api/v1/groups', alice, { name: 'X', permissions: ['everything'] })).status, 400);
            assert.equal((await call('POST', '/api/v1/groups', alice, { name: DEFAULT_GROUP })).status, 409);
        });

        it('protects the built-in groups', async () => {
            const alice = await createUser('alice', admins);
            await createUser('root', admins);

            assert.equal((await call('DELETE', `/api/v1/groups/${users.id}`, alice)).status, 409);
            assert.equal((await call('PATCH', `/api/v1/groups/${users.id}`, alice, { name: 'Everyone' })).status, 409);
            assert.equal((await call('PATCH', `/api/v1/groups/${admins.id}`, alice, { permissions: ['settings.manage'] })).status, 409);
        });

        it('will not strip users.manage from the only group that has it in use', async () => {
            const staff = await Group.create({ name: 'Staff', permissions: ['users.manage'] });
            const alice = await createUser('alice', staff);

            assert.equal((await call('PATCH', `/api/v1/groups/${staff.id}`, alice, { permissions: [] })).status, 409);
            assert.equal((await call('DELETE', `/api/v1/groups/${staff.id}`, alice)).status, 409);
            assert.deepEqual((await Group.findByPk(staff.id))!.permissions, ['users.manage']);
        });
    });
});
