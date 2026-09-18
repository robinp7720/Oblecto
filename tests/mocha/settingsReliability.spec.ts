import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigWriter } from '../../src/lib/settings/ConfigWriter.js';
import { validateSettings, mergeSettings } from '../../src/lib/settings/validation.js';
import { testProvider } from '../../src/lib/settings/providerTest.js';
import Queue from '../../src/lib/queue/index.js';
import { JobTracker } from '../../src/lib/maintenance/JobTracker.js';
import { maintenanceWork } from '../../src/lib/maintenance/dispatch.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { AxiosResponse } from 'axios';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 5));
async function until(done: () => boolean): Promise<void> {
    for (let i = 0; i < 200; i++) { if (done()) return; await tick(); }
    throw new Error('Timed out waiting for job');
}

describe('Settings persistence', () => {
    it('does not publish changes before disk persistence, and serializes patches', async () => {
        const current = { indexer: { runAtBoot: false }, cleaner: { runAtBoot: false } };
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const writes: string[] = [];
        const writer = new ConfigWriter(() => '/unused', async (_, contents) => { await gate; writes.push(contents); });
        const first = writer.update(current, draft => { draft.indexer.runAtBoot = true; });
        const second = writer.update(current, draft => { draft.cleaner.runAtBoot = true; });
        await tick();
        assert.equal(current.indexer.runAtBoot, false);
        release();
        await Promise.all([first, second]);
        assert.deepEqual(JSON.parse(writes[1]), { indexer: { runAtBoot: true }, cleaner: { runAtBoot: true } });
    });
    it('keeps active configuration intact after failure and allows retry', async () => {
        const current = { value: 1 };
        let fail = true;
        const writer = new ConfigWriter(() => '/unused', async () => { if (fail) throw new Error('disk full'); });
        await assert.rejects(writer.update(current, draft => { draft.value = 2; }), /disk full/);
        assert.equal(current.value, 1);
        fail = false;
        await writer.update(current, draft => { draft.value = 3; });
        assert.equal(current.value, 3);
    });
    it('writes a valid configuration using atomic replacement', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'oblecto-settings-'));
        try {
            const path = join(directory, 'config.json');
            await writeFile(path, '{"value":1}');
            await new ConfigWriter(() => path).update({ value: 1 }, draft => { draft.value = 2; });
            assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { value: 2 });
        } finally { await rm(directory, { recursive: true }); }
    });
    it('rejects malformed and invalid fields without accepting partial image widths', () => {
        assert.ok(validateSettings(null).settings);
        assert.ok(validateSettings({ artwork: { poster: { small: 0, medium: 20, large: 30 } } })['artwork.poster.small']);
        assert.ok(validateSettings({ artwork: { poster: { small: 10 } } })['artwork.poster.large']);
        assert.ok(validateSettings({ federation: { dataPort: 70000 } })['federation.dataPort']);
        assert.deepEqual(validateSettings({ assets: { moviePosterLocation: 'relative/posters' } }), {});
        assert.ok(validateSettings(JSON.parse('{"indexer":{"__proto__":{}}}'))['indexer.__proto__']);
    });
    it('preserves unchanged fields and masked secrets during shallow patches', () => {
        const draft = { federation: { key: '/key', enable: false }, movies: { directories: ['/movies'], doReIndex: false } };
        mergeSettings(draft, { federation: { key: '***', enable: true }, movies: { doReIndex: true } });
        assert.equal(draft.federation.key, '/key');
        assert.deepEqual(draft.movies.directories, ['/movies']);
    });
});

describe('Maintenance tracking', () => {
    it('waits for descendants and excludes unrelated queue jobs', async () => {
        const queue = new Queue(2);
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        queue.registerJob('unrelated', async () => gate);
        queue.registerJob('child', async () => { await tick(); });
        queue.registerJob('parent', async () => { await tick(); queue.queueJob('child', {}); });
        queue.queueJob('unrelated', {});
        const job = queue.maintenance.start('scan', 'movies', async () => { queue.queueJob('parent', {}); });
        const duplicate = queue.maintenance.start('scan', 'movies', async () => { throw new Error('duplicate executed'); });
        assert.equal(duplicate.id, job.id);
        await until(() => Boolean(queue.maintenance.list()[0].finishedAt));
        assert.equal(queue.maintenance.list()[0].state, 'completed');
        assert.equal(queue.maintenance.list()[0].completed, 2);
        assert.equal(queue.maintenance.list()[0].total, 2);
        assert.equal(queue.getStats().running, 1);
        release();
    });
    it('records collection and worker failures without exposing exception text', async () => {
        const queue = new Queue(1);
        queue.registerJob('fail', async () => { throw new Error('private detail'); });
        queue.maintenance.start('scan', 'movies', async () => { queue.queueJob('fail', {}); throw new Error('private collection detail'); });
        await until(() => Boolean(queue.maintenance.list()[0].finishedAt));
        const job = queue.maintenance.list()[0];
        assert.equal(job.state, 'failed');
        assert.equal(job.failed, 2);
        assert.ok(!JSON.stringify(job).includes('private'));
    });
    it('retains only the latest 100 completed jobs', async () => {
        const tracker = new JobTracker();
        for (let i = 0; i < 105; i++) tracker.start('scan', String(i), async () => {});
        await until(() => tracker.list().every(job => Boolean(job.finishedAt)));
        assert.equal(tracker.list().length, 100);
        assert.equal(tracker.list()[0].target, '104');
    });
    it('dispatches individual series and episode actions and legacy aliases', async () => {
        const calls: string[] = [];
        const call = (label: string) => async () => { calls.push(label); };
        const oblecto = {
            seriesCollector: { collectAll: call('scan-series') },
            seriesUpdateCollector: { collectAllSeries: call('metadata-series'), collectAllEpisodes: call('metadata-episodes') },
            seriesCleaner: { removeFileLessEpisodes: call('clean-episodes'), removeEpisodeslessShows: call('clean-series'), removePathLessShows: call('clean-paths') }
        } as unknown as Oblecto;
        await maintenanceWork(oblecto, 'scan', 'series')!();
        await maintenanceWork(oblecto, 'update_metadata', 'episodes')!();
        await maintenanceWork(oblecto, 'clean', 'tvshows')!();
        assert.deepEqual(calls, ['scan-series', 'metadata-episodes', 'clean-episodes', 'clean-series', 'clean-paths']);
        assert.equal(maintenanceWork(oblecto, 'scan', 'nonsense'), undefined);
        assert.equal(maintenanceWork(oblecto, '__proto__', 'all'), undefined);
    });
});

describe('Provider connection tests', () => {
    it('tests saved credentials with a timeout and returns no secret', async () => {
        const result = await testProvider('themoviedb', 'secret-key', async options => {
            assert.equal(options.timeout, 8000);
            assert.equal(options.params.api_key, 'secret-key');
            return { data: { success: true } } as AxiosResponse;
        });
        assert.equal(result.ok, true);
        assert.ok(!JSON.stringify(result).includes('secret-key'));
    });
    it('does not report success for an upstream HTML error page', async () => {
        const result = await testProvider('themoviedb', 'saved-key', async () => ({ data: '<html>Unavailable</html>' }) as AxiosResponse);
        assert.equal(result.ok, false);
        assert.equal(result.code, 'service_error');
    });
    for (const [failure, expected] of [
        [{ response: { status: 401 } }, 'invalid_key'],
        [{ response: { status: 429 } }, 'rate_limited'],
        [{ code: 'ECONNABORTED' }, 'timeout'],
        [{ response: { status: 503 } }, 'service_error']
    ] as const) {
        it(`reports ${expected} safely`, async () => {
            const result = await testProvider('tvdb', 'secret', async () => { throw { ...failure, message: 'secret' }; });
            assert.equal(result.code, expected);
            assert.ok(!result.message.includes('secret'));
        });
    }
});

describe('Settings route contracts', () => {
    it('validates the entire request before writing and rejects invalid maintenance targets', async () => {
        const { default: settingsRoutes } = await import('../../src/submodules/REST/routes/v1/settings.js');
        const { default: systemRoutes } = await import('../../src/submodules/REST/routes/v1/system.js');
        const { ConfigManager } = await import('../../src/config.js');
        const original = ConfigManager.updateConfig;
        let writes = 0;
        ConfigManager.updateConfig = async () => { writes++; };
        try {
            const router = fakeRouter();
            const current = { indexer: { runAtBoot: false } };
            settingsRoutes(router.server, { config: current });
            systemRoutes(router.server, { queue: new Queue(1) });
            const response = fakeResponse();
            await router.call('patch /api/v1/settings', { body: { indexer: { runAtBoot: true }, artwork: { poster: { small: -1 } } } }, response);
            assert.equal(response.statusCode, 400);
            assert.equal(writes, 0);
            assert.equal(current.indexer.runAtBoot, false);
            await router.call('post /api/v1/system/maintenance', { body: { action: 'scan', target: 'typo' } }, response);
            assert.equal(response.statusCode, 400);
        } finally { ConfigManager.updateConfig = original; }
    });
    it('waits for persistence before replying, and surfaces write failures', async () => {
        const { default: settingsRoutes } = await import('../../src/submodules/REST/routes/v1/settings.js');
        const { ConfigManager } = await import('../../src/config.js');
        const original = ConfigManager.updateConfig;
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const writer = new ConfigWriter(() => '/unused', async () => gate);
        ConfigManager.updateConfig = (change, current) => writer.update(current!, change);
        try {
            const router = fakeRouter();
            const current = { indexer: { runAtBoot: false } };
            settingsRoutes(router.server, { config: current });
            const response = fakeResponse();
            const pending = router.call('patch /api/v1/settings/:section', { params: { section: 'indexer' }, body: { runAtBoot: true } }, response);
            await tick();
            assert.equal(response.body, undefined);
            assert.equal(current.indexer.runAtBoot, false);
            release();
            await pending;
            assert.deepEqual(response.body, { runAtBoot: true });
            ConfigManager.updateConfig = async () => { throw new Error('disk full'); };
            await assert.rejects(router.call('patch /api/v1/settings', { body: { indexer: { runAtBoot: false } } }, fakeResponse()), /disk full/);
            assert.equal(current.indexer.runAtBoot, true);
        } finally { ConfigManager.updateConfig = original; }
    });
});

import type { Express, Request, Response, RequestHandler } from 'express';
function fakeRouter() {
    const handlers = new Map<string, RequestHandler>();
    const register = (method: string) => (path: string, ...callbacks: RequestHandler[]) => {
        assert.ok(callbacks.length >= 2, 'Endpoints must include authentication middleware');
        handlers.set(`${method} ${path}`, callbacks.at(-1)!);
    };
    return {
        server: { get: register('get'), post: register('post'), patch: register('patch') } as unknown as Express,
        call: async (key: string, request: object, response: object) => handlers.get(key)!(request as Request, response as Response, error => { throw error; })
    };
}
function fakeResponse() {
    return {
        statusCode: 200, body: undefined as unknown,
        status(code: number) { this.statusCode = code; return this; },
        send(body: unknown) { this.body = body; return this; }
    };
}

describe('settings validation against the template', () => {
    const current = { server: { port: 8080, legacyFlag: true }, authentication: { secret: 'x'.repeat(32) }, streaming: {} };

    it('refuses fields nothing reads, but keeps ones the config already has', () => {
        assert.equal(validateSettings({ server: { prot: 80 } }, current)['server.prot'], 'Unknown setting.');
        assert.deepEqual(validateSettings({ server: { legacyFlag: false } }, current), {});
        assert.deepEqual(validateSettings({ streaming: { cacheDirectory: '/var/cache/oblecto' } }, current), {});
    });

    it('checks each value has the same kind as the template', () => {
        assert.match(validateSettings({ queue: { concurrency: '4' } }, current)['queue.concurrency'], /number/);
        assert.equal(validateSettings({ web: { enabled: 'yes' } }, current)['web.enabled'], 'Expected an on/off value.');
        assert.match(validateSettings({ fileExtensions: { video: 'mkv' } }, current)['fileExtensions.video'], /list/);
    });

    it('refuses a short, placeholder or non-text signing secret, but lets the masked value through', () => {
        for (const secret of ['short', 'secret', 42]) assert.ok(validateSettings({ authentication: { secret } }, current)['authentication.secret'], String(secret));
        assert.deepEqual(validateSettings({ authentication: { secret: '***' } }, current), {});
        assert.deepEqual(validateSettings({ authentication: { secret: 'a-long-random-signing-secret' } }, current), {});
    });

    it('stays lenient about unknown fields when checking a config at startup', () => {
        assert.deepEqual(validateSettings({ server: { prot: 80 } }), {});
    });
});
