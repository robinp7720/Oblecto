/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import express, { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize';
import authRoutes from '../../src/submodules/REST/routes/auth.js';
import { User, userColumns } from '../../src/models/user.js';

// Requests come from 127.0.0.1; trustProxy plus a public X-Forwarded-For makes one remote.
const REMOTE = { 'X-Forwarded-For': '8.8.8.8' };

describe('login options and local-network sign-in', () => {
    let sequelize: Sequelize;
    let server: Server;
    let base: string;
    const authentication: any = {};
    const oblecto: any = { config: { authentication } };

    const call = async (method: string, path: string, body?: object, headers: Record<string, string> = {}) => {
        const response = await fetch(base + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: body ? JSON.stringify(body) : undefined
        });

        return { status: response.status, body: await response.json() };
    };

    before(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite', storage: ':memory:', logging: false
        });
        User.init(userColumns, { sequelize, modelName: 'User' });
        await sequelize.sync();

        const password = await bcrypt.hash('hunter2', 4);

        await User.bulkCreate([
            {
                username: 'alice', name: 'Alice', email: 'alice@example.com', password, publicProfile: true, passwordlessLocal: true, avatar: '1-1.webp'
            },
            {
                username: 'bob', name: 'Bob', email: 'bob@example.com', password, publicProfile: true, passwordlessLocal: false, avatar: null
            },
            {
                username: 'carol', name: 'Carol', email: 'carol@example.com', password: null, publicProfile: false, passwordlessLocal: false, avatar: null
            },
        ]);

        const app = express();

        app.use(express.json());
        authRoutes(app, oblecto);
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

    beforeEach(() => {
        for (const key of Object.keys(authentication)) delete authentication[key];
        Object.assign(authentication, {
            secret: 'test-secret',
            allowPasswordlessLogin: true,
            profilePicker: true,
            localPasswordlessLogin: true,
            localSubnets: [],
            trustProxy: true
        });
    });

    it('lists only public users to local clients, without emails', async () => {
        const { status, body } = await call('GET', '/auth/login-options');

        assert.equal(status, 200);
        assert.equal(body.local, true);
        assert.equal(body.profilePicker, true);
        assert.deepEqual(body.users.map((user: any) => user.username), ['alice', 'bob']);
        assert.deepEqual(Object.keys(body.users[0]).sort(), ['avatar', 'id', 'name', 'passwordless', 'username']);
        assert.equal(body.users[0].passwordless, true);
        assert.equal(body.users[1].passwordless, false);
    });

    it('lists nobody to remote clients or when the picker is off', async () => {
        const remote = await call('GET', '/auth/login-options', undefined, REMOTE);

        assert.equal(remote.body.local, false);
        assert.deepEqual(remote.body.users, []);

        authentication.profilePicker = false;
        const off = await call('GET', '/auth/login-options');

        assert.equal(off.body.profilePicker, false);
        assert.deepEqual(off.body.users, []);
    });

    it('signs an opted-in user in without a password on the local network, by id or name', async () => {
        const alice = await User.findOne({ where: { username: 'alice' } });
        const byId = await call('POST', '/auth/login', { userId: alice!.id });

        assert.equal(byId.status, 200);
        assert.equal((jwt.verify(byId.body.accessToken, 'test-secret') as any).username, 'alice');
        assert.equal((await call('POST', '/auth/login', { username: 'alice' })).status, 200);
    });

    it('still needs a password for users who did not opt in, or when the server switch is off', async () => {
        assert.equal((await call('POST', '/auth/login', { username: 'bob' })).status, 400);
        assert.equal((await call('POST', '/auth/login', { username: 'bob', password: 'wrong' })).status, 401);
        assert.equal((await call('POST', '/auth/login', { username: 'bob', password: 'hunter2' })).status, 200);

        authentication.localPasswordlessLogin = false;
        assert.equal((await call('POST', '/auth/login', { username: 'alice' })).status, 400);
    });

    it('never signs in without a password from a remote network', async () => {
        assert.equal((await call('POST', '/auth/login', { username: 'alice' }, REMOTE)).status, 400);
        assert.equal((await call('POST', '/auth/login', { username: 'carol' }, REMOTE)).status, 400);
        assert.equal((await call('POST', '/auth/login', { username: 'alice', password: 'hunter2' }, REMOTE)).status, 200);
    });

    it('limits allowPasswordlessLogin for password-less accounts to the local network', async () => {
        assert.equal((await call('POST', '/auth/login', { username: 'carol' })).status, 200);

        authentication.allowPasswordlessLogin = false;
        assert.equal((await call('POST', '/auth/login', { username: 'carol' })).status, 400);
    });

    it('rejects unknown users and requests without a user', async () => {
        assert.equal((await call('POST', '/auth/login', { username: 'nobody' })).status, 401);
        assert.equal((await call('POST', '/auth/login', {})).status, 400);
    });
});
