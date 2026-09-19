import assert from 'node:assert/strict';
import { configPath, DEFAULT_CONFIG_PATH, withDefaults } from '../../src/config.js';
import { startupProblems } from '../../src/lib/settings/startupChecks.js';
import defaults from '../../res/config.json';
import type { IConfig } from '../../src/interfaces/config.js';

const valid = (): IConfig => withDefaults(defaults as unknown as IConfig, { authentication: { secret: 'a-real-secret' } });

describe('Config loading', function () {
    describe('configPath', function () {
        let saved: string | undefined;

        beforeEach(() => { saved = process.env.OBLECTO_CONFIG_PATH; });
        afterEach(() => {
            if (saved === undefined) delete process.env.OBLECTO_CONFIG_PATH;
            else process.env.OBLECTO_CONFIG_PATH = saved;
        });

        it('uses OBLECTO_CONFIG_PATH when set', function () {
            process.env.OBLECTO_CONFIG_PATH = '/tmp/elsewhere.json';
            assert.equal(configPath(), '/tmp/elsewhere.json');
        });

        it('falls back to /etc/oblecto, never to the sample in the working directory', function () {
            delete process.env.OBLECTO_CONFIG_PATH;
            assert.equal(configPath(), DEFAULT_CONFIG_PATH);
            process.env.OBLECTO_CONFIG_PATH = '';
            assert.equal(configPath(), DEFAULT_CONFIG_PATH);
        });
    });

    describe('withDefaults', function () {
        it('fills sections and keys the file leaves out', function () {
            const merged = withDefaults(defaults as unknown as IConfig, { server: { port: 9000 } });

            assert.equal(merged.server.port, 9000);
            assert.deepEqual(merged.ffmpeg, { pathFFmpeg: null, pathFFprobe: null });
            assert.equal(merged.authentication.saltRounds, 10);
        });

        it('lets arrays in the file replace the defaults instead of merging into them', function () {
            const merged = withDefaults(defaults as unknown as IConfig, { fileExtensions: { video: ['webm'] } });

            assert.deepEqual(merged.fileExtensions.video, ['webm']);
        });

        it('does not share objects with the defaults', function () {
            const merged = withDefaults(defaults as unknown as IConfig, {});

            merged.server.port = 1;
            assert.notEqual((defaults as unknown as IConfig).server.port, 1);
        });

        it('ignores prototype keys', function () {
            const merged = withDefaults({ a: 1 }, JSON.parse('{"__proto__": {"polluted": true}}'));

            assert.equal((merged as Record<string, unknown>).polluted, undefined);
            assert.equal(({} as Record<string, unknown>).polluted, undefined);
        });
    });

    describe('startupProblems', function () {
        it('accepts a config with a real secret', function () {
            assert.deepEqual(startupProblems(valid(), null), []);
        });

        it('refuses an empty or placeholder secret', function () {
            for (const secret of ['', 'secret', '  ']) {
                const config = valid();

                config.authentication.secret = secret;
                assert.match(startupProblems(config, null).join('\n'), /authentication\.secret/);
            }
        });

        it('reports why the file could not be read', function () {
            assert.deepEqual(startupProblems(valid(), 'No config file at /x'), ['No config file at /x']);
        });

        it('reports mistyped settings by name', function () {
            const config = valid();

            (config.federation as { dataPort: unknown }).dataPort = 'nine';
            assert.deepEqual(startupProblems(config, null), ['federation.dataPort: Enter a port from 1 to 65535.']);
        });

        it('ships a template that is safe by default', function () {
            const template = defaults as unknown as IConfig;

            assert.equal(template.authentication.secret, '');
            assert.equal(template.authentication.allowPasswordlessLogin, false);
            assert.equal(template.authentication.profilePicker, false);
            assert.deepEqual(template.federation.servers, {});
            assert.deepEqual(template.federation.clients, {});
            // The project's metadata keys ship with it, so a new install can identify files straight away.
            for (const provider of ['tvdb', 'themoviedb', 'fanart.tv'] as const) assert.ok(template[provider].key);
        });
    });
});
