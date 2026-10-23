import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SegmentCache } from '../../src/lib/playback/cache.js';
import { SegmentWindows } from '../../src/lib/playback/windows.js';
import { Scheduler } from '../../src/lib/playback/process.js';
import { preparedMetadata } from '../../src/lib/playback/metadataCache.js';
import { resolvePreferences } from '../../src/lib/users/preferences.js';
import PlaybackTelemetry from '../../Oblecto-Web/src/playback/PlaybackTelemetry.js';

describe('Playback pipeline resource ownership', () => {
    it('serves a closed segment before the sequential producer exits, shares generation, and awaits cancellation', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-window-test-'));
        const cache = new SegmentCache(1024, root);
        const windows = new SegmentWindows(cache);
        const controller = new AbortController();
        const operations: Promise<void>[] = [];
        let generated = 0; let finished = false;
        const generate = async (directory: string, _start: number, _end: number, signal: AbortSignal) => {
            generated++;
            await fs.writeFile(path.join(directory, '0.ts'), 'complete first segment');
            await new Promise<void>(resolve => signal.addEventListener('abort', () => { finished = true; resolve(); }, { once: true }));
        };
        try {
            const acquire = (index: number) => windows.acquire('viewer', 'viewer/1/360', index, 3, controller.signal, generate, task => operations.push(task));
            const [first, duplicate] = await Promise.all([acquire(0), acquire(0)]);
            assert.equal(await fs.readFile(first.path, 'utf8'), 'complete first segment');
            assert.equal(first.path, duplicate.path); assert.equal(generated, 1); assert.equal(finished, false);
            first.release(); duplicate.release();
            const cancelled = assert.rejects(acquire(1), /not produced/);
            controller.abort();
            await cancelled; await Promise.all(operations);
            assert.equal(finished, true);
            assert.ok(!(await fs.readdir(await cache.root)).some(file => file.startsWith('window-')));
        } finally { controller.abort(); await Promise.allSettled(operations); await cache.close(); await fs.rm(root, { recursive: true, force: true }); }
    });
    it('rejects cancelled producers and staging failures without leaving waiters unresolved', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-window-failure-'));
        const cache = new SegmentCache(1024, root); const windows = new SegmentWindows(cache);
        await fs.rm(await cache.root, { recursive: true, force: true });
        const operations: Promise<void>[] = [];
        try {
            await assert.rejects(windows.acquire('viewer', 'viewer/1/360', 0, 1, new AbortController().signal,
                async () => {}, task => operations.push(task)), /ENOENT/);
            await Promise.allSettled(operations);
        } finally { await cache.close(); await fs.rm(root, { recursive: true, force: true }); }
    });
    it('awaits the cancelled producer before starting work for a distant seek', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-window-seek-'));
        const cache = new SegmentCache(1024, root); const windows = new SegmentWindows(cache);
        const controller = new AbortController(); const operations: Promise<void>[] = [];
        let running = 0; let maximum = 0; let calls = 0;
        const generate = async (directory: string, start: number, _end: number, signal: AbortSignal) => {
            calls++; running++; maximum = Math.max(maximum, running);
            try {
                await fs.writeFile(path.join(directory, `${start}.ts`), 'complete segment');
                await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
            } finally { running--; }
        };
        try {
            const acquire = (index: number) => windows.acquire('viewer', 'viewer/1/360', index, 30, controller.signal, generate, task => operations.push(task));
            const first = await acquire(0); first.release();
            const second = await acquire(12); second.release();
            assert.equal(calls, 2); assert.equal(maximum, 1);
            controller.abort(); await Promise.all(operations);
            assert.equal(running, 0);
        } finally { controller.abort(); await Promise.allSettled(operations); await cache.close(); await fs.rm(root, { recursive: true, force: true }); }
    });
    it('keeps concurrent publications within the cache budget while files are pinned', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-cache-race-'));
        const cache = new SegmentCache(10, root);
        const gate = Promise.withResolvers<void>();
        try {
            const create = (key: string) => cache.acquire(key, async file => { await fs.writeFile(file, '12345678'); await gate.promise; });
            const first = create('a'); const second = create('b'); gate.resolve();
            const results = await Promise.allSettled([first, second]);
            assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
            assert.equal(cache.bytes, 8);
            for (const result of results) if (result.status === 'fulfilled') result.value.release();
        } finally { await cache.close(); await fs.rm(root, { recursive: true, force: true }); }
    });
    it('promotes only the requested speculative segment, leaving other prefetch at low priority', async () => {
        const scheduler = new Scheduler(1); const signal = new AbortController().signal;
        const gate = Promise.withResolvers<void>(); const order: string[] = [];
        const active = scheduler.submit('blocker', signal, () => gate.promise);
        const old = scheduler.submit('viewer', signal, async () => { order.push('old'); }, 1, 'old');
        const requested = scheduler.submit('viewer', signal, async () => { order.push('requested'); }, 1, 'requested');
        const other = scheduler.submit('other viewer', signal, async () => { order.push('other'); });
        scheduler.promote('viewer', 'requested'); gate.resolve();
        await Promise.all([active, old, requested, other]);
        assert.deepEqual(order, ['requested', 'other', 'old']);
    });
    it('schedules demand ahead of prefetch and keeps a slot available for new viewers', async () => {
        const scheduler = new Scheduler(2);
        const signal = new AbortController().signal;
        const gate = Promise.withResolvers<void>(); const order: string[] = [];
        const background = scheduler.submit('background', signal, () => gate.promise, 1);
        const prefetch = scheduler.submit('another', signal, async () => { order.push('prefetch'); }, 1);
        const demand = scheduler.submit('viewer', signal, async () => { order.push('demand'); });
        await demand;
        assert.deepEqual(order, ['demand']);
        gate.resolve(); await Promise.all([background, prefetch]);
        assert.deepEqual(order, ['demand', 'prefetch']);
    });
});

describe('Playback defaults and telemetry', () => {
    it('defaults to Auto without replacing explicit preferences', () => {
        assert.equal(resolvePreferences(null).quality, 'auto');
        assert.equal(resolvePreferences({ quality: 'original' }).quality, 'original');
        assert.equal(resolvePreferences({ quality: 240 }).quality, 240);
        assert.equal(preparedMetadata({ version: 1 } as any, 'file-version'), null);
    });
    it('counts rebuffering after playback starts, excluding startup, seeking and pause', () => {
        let now = 0; const telemetry = new PlaybackTelemetry(() => now);
        const video = { currentTime: 10, paused: false, seeking: false, ended: false, playbackRate: 1, readyState: 2,
            played: { length: 0 }, buffered: { length: 1, start: () => 5, end: () => 16 } };
        telemetry.buffering = true; telemetry.sample(video); now = 1000;
        assert.equal(telemetry.report(video).rebufferDurationMs, 0);
        telemetry.hasPlayed = true; telemetry.sample(video); now = 1500;
        assert.equal(telemetry.report(video).rebufferDurationMs, 500);
        assert.equal(telemetry.report(video).bufferedSeconds, 6);
        telemetry.seeking = true; telemetry.sample(video); now = 2500; telemetry.report(video);
        assert.equal(telemetry.rebufferDurationMs, 500);
        telemetry.seeking = false; video.paused = true; telemetry.sample(video); now = 3500;
        assert.equal(telemetry.report(video).rebufferDurationMs, 500);
        video.paused = false; telemetry.sample(video); now = 4000;
        video.paused = true; telemetry.sample(video); now = 5000;
        assert.equal(telemetry.report(video).rebufferDurationMs, 1000, 'the pause counts only the stall before it');
    });
});
