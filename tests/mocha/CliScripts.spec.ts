import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';

import { User, userColumns } from '../../src/models/user.js';

// adduser/deluser/changepassword/removepassword all call the real,
// process-lifetime singleton initDatabase(), which runs initAssociations()
// across every model (Movie, MovieSet, Series, Episode, ...) the first time
// it's called - not just User. Calling it in-process here would permanently
// mutate those shared model classes for every other spec file in the same
// mocha run. adduser/changepassword also hard-code a read of
// /etc/oblecto/config.json, bypassing the app's normal OBLECTO_CONFIG_PATH/
// res/config.json resolution entirely (a real inconsistency, noted
// separately). To avoid both problems, each scenario below is run as a
// genuinely separate child process - which also mirrors how these scripts
// actually run in production (a one-shot CLI invocation, not a persistent
// session). The main test process only ever holds its own sqlite connection
// open long enough to seed/inspect data, and always closes it before
// spawning the child, to avoid file-lock contention between the two.
describe('CLI user management scripts', function () {
    this.timeout(15000);

    let tmpDir: string;
    let dbPath: string;
    let driverPath: string;

    const repoRoot = path.resolve(__dirname, '..', '..');

    before(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oblecto-cli-'));
        dbPath = path.join(tmpDir, 'database.sqlite');

        const configPath = path.join(tmpDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            authentication: { secret: 'test-secret', saltRounds: 4, allowPasswordlessLogin: false },
            database: { dialect: 'sqlite', storage: dbPath, username: '', password: '', database: 'test' },
            queue: { concurrency: 1 }
        }));

        // adduser.ts/changepassword.ts hard-code this exact path.
        fs.mkdirSync('/etc/oblecto', { recursive: true });
        fs.writeFileSync('/etc/oblecto/config.json', fs.readFileSync(configPath, 'utf8'));

        const scriptsDir = path.join(repoRoot, 'src/bin/scripts').split(path.sep).join('/');

        driverPath = path.join(tmpDir, 'driver.mts');
        fs.writeFileSync(driverPath, [
            `const scriptsDir = ${JSON.stringify(scriptsDir)};`,
            'const [, , name, ...args] = process.argv;',
            'const mod = await import(`${scriptsDir}/${name}.ts`);',
            'await mod.default(args);'
        ].join('\n'));
    });

    after(() => {
        fs.rmSync('/etc/oblecto', { recursive: true, force: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const withDb = async <T>(fn: () => Promise<T>): Promise<T> => {
        const sequelize = new Sequelize({ dialect: 'sqlite', storage: dbPath, logging: false });
        User.init(userColumns, { sequelize, modelName: 'User' });

        try {
            return await fn();
        } finally {
            await sequelize.close();
        }
    };

    beforeEach(async () => {
        await withDb(() => User.sync({ force: true }));
    });

    const run = (name: string, args: string[]): string => {
        const tsxBin = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

        return execFileSync(tsxBin, [driverPath, name, ...args], {
            cwd: repoRoot,
            env: { ...process.env, OBLECTO_CONFIG_PATH: '/etc/oblecto/config.json' },
            encoding: 'utf8'
        });
    };

    describe('adduser', () => {
        it('prints a usage error when too few arguments are given', () => {
            const output = run('adduser', ['adduser', 'onlyusername']);
            assert.ok(output.includes('Invalid number of arguments'));
        });

        it('creates a user with a bcrypt-hashed password', async () => {
            const output = run('adduser', ['adduser', 'robin', 'hunter2', 'Robin', 'robin@x.com']);
            assert.ok(output.includes('has been created'));

            await withDb(async () => {
                const user = await User.findOne({ where: { username: 'robin' } });
                assert.ok(user);
                assert.equal(user!.name, 'Robin');
                assert.ok(await bcrypt.compare('hunter2', user!.password as string));
            });
        });

        it('does not create a duplicate user for an existing username', async () => {
            run('adduser', ['adduser', 'dup', 'p1', 'Dup', 'dup@x.com']);
            const output = run('adduser', ['adduser', 'dup', 'p2', 'Dup', 'dup@x.com']);

            assert.ok(output.includes('already exists'));
            await withDb(async () => {
                assert.equal(await User.count({ where: { username: 'dup' } }), 1);
            });
        });
    });

    describe('deluser', () => {
        it('prints a usage error when no username is given', () => {
            const output = run('deluser', ['deluser']);
            assert.ok(output.includes('Invalid number of arguments'));
        });

        it('deletes an existing user', async () => {
            await withDb(() => User.create({ username: 'todelete' }));

            const output = run('deluser', ['deluser', 'todelete']);

            assert.ok(output.includes('has been deleted'));
            await withDb(async () => {
                assert.equal(await User.count({ where: { username: 'todelete' } }), 0);
            });
        });

        it('reports when the user does not exist', () => {
            const output = run('deluser', ['deluser', 'ghost']);
            assert.ok(output.includes('was not found'));
        });
    });

    describe('changepassword', () => {
        it('prints a usage error when too few arguments are given', () => {
            const output = run('changepassword', ['changepassword', 'onlyusername']);
            assert.ok(output.includes('Invalid number of arguments'));
        });

        it('updates the password hash for an existing user', async () => {
            await withDb(async () => User.create({ username: 'haspw', password: await bcrypt.hash('old', 4) }));

            const output = run('changepassword', ['changepassword', 'haspw', 'newpass']);

            assert.ok(output.includes('password has been changed'));
            await withDb(async () => {
                const user = await User.findOne({ where: { username: 'haspw' } });
                assert.ok(await bcrypt.compare('newpass', user!.password as string));
            });
        });

        it('reports when the user does not exist', () => {
            const output = run('changepassword', ['changepassword', 'ghost', 'x']);
            assert.ok(output.includes('was not found'));
        });
    });

    describe('removepassword', () => {
        it('prints a usage error when no username is given', () => {
            const output = run('removepassword', ['removepassword']);
            assert.ok(output.includes('Invalid number of arguments'));
        });

        it('clears the password for an existing user', async () => {
            await withDb(async () => User.create({ username: 'haspw2', password: await bcrypt.hash('old', 4) }));

            const output = run('removepassword', ['removepassword', 'haspw2']);

            assert.ok(output.includes('password has been removed'));
            await withDb(async () => {
                const user = await User.findOne({ where: { username: 'haspw2' } });
                assert.equal(user!.password, '');
            });
        });

        it('reports when the user does not exist', () => {
            const output = run('removepassword', ['removepassword', 'ghost']);
            assert.ok(output.includes('was not found'));
        });
    });
});
