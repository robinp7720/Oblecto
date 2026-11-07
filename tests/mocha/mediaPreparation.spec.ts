import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MediaPreparation, type PreparationDependencies, type PreparationSource } from '../../src/lib/playback/MediaPreparation.js';
import { Scheduler } from '../../src/lib/playback/process.js';
import { waitFor, type PreparedMetadata } from '../../src/lib/playback/metadataCache.js';
import { type Media, PlaybackError } from '../../src/lib/playback/types.js';

describe('Playback preparation boundary', () => {
    let directory: string;
    let source: PreparationSource;
    let lifetime: AbortController;
    let scheduler: Scheduler;
    let saved: PreparedMetadata[];
    const streams = [{ index: 0, codec_type: 'video', codec_name: 'h264', width: 640, height: 360, pix_fmt: 'yuv420p' }];
    const probeOutput = JSON.stringify({ format: { duration: '12' }, streams });
    const frames = (times: number[]): string => JSON.stringify({ frames: times.map(time => ({ best_effort_timestamp_time: String(time) })) });
    const cancelled = (error: unknown): boolean => error instanceof PlaybackError && error.code === 'CANCELLED';
    const media = (): Media => ({ path: source.path!, duration: 12, size: 7, container: 'mp4', streams });
    const create = (run: PreparationDependencies<PreparationSource>['run']): MediaPreparation<PreparationSource> => new MediaPreparation({
        scheduler,
        signal: lifetime.signal,
        ffprobe: () => 'test-probe',
        defaultLanguage: () => 'eng',
        loadMetadata: () => Promise.resolve(null),
        saveMetadata: (_file, metadata) => { saved.push(metadata); return Promise.resolve(); },
        queueAnalysis: () => {},
        run
    });

    beforeEach(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-preparation-'));
        source = { path: path.join(directory, 'source.mp4'), host: 'local' };
        await fs.writeFile(source.path!, 'fixture');
        lifetime = new AbortController();
        scheduler = new Scheduler(1);
        saved = [];
    });
    afterEach(async () => {
        lifetime.abort();
        await scheduler.settled();
        await fs.rm(directory, { recursive: true, force: true });
    });

    it('shares concurrent probes and retries invalid results without database or server dependencies', async () => {
        let calls = 0;
        const preparation = create(() => {
            calls++;
            return Promise.resolve(calls === 1 ? JSON.stringify({ format: { duration: 'NaN' }, streams }) : probeOutput);
        });
        await assert.rejects(preparation.probe(source), (error: unknown) => error instanceof PlaybackError && error.code === 'UNSUPPORTED_MEDIA');
        const [first, second] = await Promise.all([preparation.probe(source), preparation.probe(source)]);
        assert.equal(first, second);
        assert.equal(first.duration, 12);
        assert.equal(calls, 2);
        assert.equal(await preparation.probe(source), first);
        assert.equal(calls, 2);
    });

    it('lets one viewer cancel a shared keyframe scan while another finishes remux preparation', async () => {
        const started = Promise.withResolvers<void>();
        const output = Promise.withResolvers<string>();
        let calls = 0;
        const preparation = create((_binary, _args, signal) => {
            calls++;
            started.resolve();
            return waitFor(output.promise, signal!);
        });
        const viewer = new AbortController();
        const first = preparation.prepare(media(), { forceHls: true }, viewer.signal);
        const survivor = preparation.prepare(media(), { forceHls: true }, lifetime.signal);
        await started.promise;
        viewer.abort();
        await assert.rejects(first, cancelled);
        assert.equal(lifetime.signal.aborted, false);
        output.resolve(frames([8, 0, 4, 4, 12, -1]));
        const plan = await survivor;
        assert.equal(plan.method, 'remux');
        assert.deepEqual(plan.boundaries, [0, 4, 8, 12]);
        assert.equal(calls, 1);
    });

    it('falls back safely after a failed keyframe scan and retries preparation later', async () => {
        let calls = 0;
        const preparation = create(() => {
            calls++;
            return calls === 1 ? Promise.reject(new Error('probe failed')) : Promise.resolve(frames([0, 4, 8]));
        });
        assert.equal((await preparation.prepare(media(), { forceHls: true }, lifetime.signal)).method, 'transcode');
        assert.equal((await preparation.prepare(media(), { forceHls: true }, lifetime.signal)).method, 'remux');
        assert.equal(calls, 2);
    });

    it('cancels active and queued analysis through the shared service lifetime without persisting results', async () => {
        const started = Promise.withResolvers<void>();
        const never = Promise.withResolvers<string>();
        let calls = 0;
        const preparation = create((_binary, _args, signal) => {
            calls++;
            started.resolve();
            return waitFor(never.promise, signal!);
        });
        const other = { path: path.join(directory, 'other.mp4') };
        await fs.writeFile(other.path, 'fixture');
        const queued = Promise.withResolvers<void>();
        const submit = scheduler.submit.bind(scheduler);
        scheduler.submit = (owner, signal, task, priority, key) => {
            const result = submit(owner, signal, task, priority, key);
            if (scheduler.queued > 0) queued.resolve();
            return result;
        };
        const first = assert.rejects(preparation.analyseFile(source), cancelled);
        await started.promise;
        const second = assert.rejects(preparation.analyseFile(other), cancelled);
        await queued.promise;
        lifetime.abort();
        await Promise.all([first, second]);
        await scheduler.settled();
        assert.equal(calls, 1);
        assert.equal(scheduler.active, 0);
        assert.equal(scheduler.queued, 0);
        assert.deepEqual(saved, []);
    });

    it('does not persist preparation for a file that changes during analysis', async () => {
        const scanning = Promise.withResolvers<void>();
        const output = Promise.withResolvers<string>();
        const preparation = create((_binary, args, signal) => {
            if (!args.includes('-show_frames')) return Promise.resolve(probeOutput);
            scanning.resolve();
            return waitFor(output.promise, signal!);
        });
        const analysis = preparation.analyseFile(source);
        await scanning.promise;
        await fs.appendFile(source.path!, 'changed');
        output.resolve(frames([0, 4, 8]));
        await analysis;
        assert.deepEqual(saved, []);
    });
});
