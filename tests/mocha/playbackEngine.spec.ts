import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { Server } from 'node:http';
import { PlaybackService } from '../../src/lib/playback/PlaybackService.js';
import { run, Scheduler } from '../../src/lib/playback/process.js';
import { SegmentCache } from '../../src/lib/playback/cache.js';
import { planPlayback } from '../../src/lib/playback/planner.js';
import { embyPlayback } from '../../src/lib/embyEmulation/ServerAPI/playback.js';
import type EmbyEmulation from '../../src/lib/embyEmulation/index.js';
import { byteRange } from '../../src/lib/playback/http.js';
import { validateOptions, PlaybackError } from '../../src/lib/playback/types.js';
import type { Media } from '../../src/lib/playback/types.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { File } from '../../src/models/file.js';

const media: Media = { path: '/fixture.mp4', container: 'mp4', duration: 12, size: 1000000, streams: [
    { index: 0, codec_type: 'video', codec_name: 'h264', profile: 'High', level: 31, width: 1280, height: 720, pix_fmt: 'yuv420p' },
    { index: 1, codec_type: 'audio', codec_name: 'aac', channels: 2, tags: { language: 'eng' }, disposition: { default: 1 } },
    { index: 2, codec_type: 'audio', codec_name: 'ac3', channels: 6, tags: { language: 'jpn' } },
    { index: 3, codec_type: 'subtitle', codec_name: 'subrip', tags: { language: 'eng' }, disposition: { forced: 1 } },
    { index: 4, codec_type: 'subtitle', codec_name: 'ass' }
] };
describe('Playback planner and validation', () => {
    it('checks codecs and selected audio rather than container alone', () => {
        assert.equal(planPlayback(media, {}).method, 'direct');
        assert.equal(planPlayback(media, { audioStreamIndex: 2 }).method, 'transcode');
        assert.equal(planPlayback({ ...media, container: 'mkv' }, {}).method, 'remux');
        assert.equal(planPlayback({ ...media, streams: [{ ...media.streams[0], codec_name: 'hevc' }] }, {}).method, 'transcode');
    });
    it('uses forced subtitles, disables them explicitly, and burns ASS', () => {
        assert.equal(planPlayback(media, {}).subtitle?.index, 3);
        assert.equal(planPlayback(media, { subtitleMode: 'off' }).subtitle, null);
        assert.equal(planPlayback(media, { subtitleStreamIndex: 4 }).burnSubtitles, true);
        assert.throws(() => planPlayback(media, { audioStreamIndex: 90 }), /Track/);
    });
    it('limits adaptive renditions to source resolution and bitrate', () => {
        assert.deepEqual(planPlayback(media, { quality: 'auto' }).renditions.map(r => r.height), [360, 480, 720]);
        assert.deepEqual(planPlayback(media, { maxBitrate: 1600000 }).renditions.map(r => r.height), [360, 480]);
        assert.equal(planPlayback(media, { quality: 1080 }).renditions[0].height, 720);
    });
    it('handles absent audio and requires HDR capability', () => {
        assert.equal(planPlayback({ ...media, streams: [media.streams[0]] }, {}).audio, null);
        assert.equal(planPlayback({ ...media, streams: [{ ...media.streams[0], color_transfer: 'smpte2084' }] }, {}).method, 'transcode');
    });
    it('rejects malformed options before allocating playback work', () => {
        for (const options of [{ position: -1 }, { position: Infinity }, { quality: 'bad' }, { audioStreamIndex: 1.5 }, { maxBitrate: 1 }, { capabilities: { hls: 'yes' } }]) assert.throws(() => validateOptions(options as never), PlaybackError);
    });
    it('supports normal/open/suffix ranges and rejects invalid or multiple ranges', () => {
        assert.deepEqual(byteRange('bytes=5-99', 10), { start: 5, end: 9 });
        assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
        assert.deepEqual(byteRange('bytes=5-', 10), { start: 5, end: 9 });
        for (const range of ['bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=0-1,3-4', 'wat', 'bytes=-']) assert.throws(() => byteRange(range, 10), /range/);
    });
});

describe('Playback scheduling and cache', () => {
    it('bounds the queue and cancels queued jobs', async () => {
        const scheduler = new Scheduler(1, 1); const signal = new AbortController();
        let release!: () => void;
        const first = scheduler.submit('a', signal.signal, () => new Promise<void>(resolve => { release = resolve; }));
        const waiting = new AbortController();
        const second = scheduler.submit('b', waiting.signal, async () => 'never');
        await assert.rejects(scheduler.submit('c', signal.signal, async () => 'full'), /busy/);
        waiting.abort(); await assert.rejects(second, /cancelled/); release(); await first;
        assert.equal(scheduler.queued, 0);
    });
    it('deduplicates generation, pins active files, and evicts released data', async () => {
        const cache = new SegmentCache(6); let calls = 0;
        const generate = async (output: string) => { calls++; await fs.writeFile(output, '123456'); };
        try {
            const [a, b] = await Promise.all([cache.acquire('a', generate), cache.acquire('a', generate)]);
            assert.equal(calls, 1); assert.equal(a.path, b.path);
            await assert.rejects(cache.acquire('b', generate), /full/);
            a.release(); b.release();
            const c = await cache.acquire('c', generate); c.release();
            await assert.rejects(fs.stat(a.path)); assert.equal(cache.bytes, 6);
        } finally { await cache.close(); }
    });
    it('terminates and awaits an aborted media process', async () => {
        const abort = new AbortController();
        const child = run(process.execPath, ['-e', 'setInterval(() => {}, 100)'], abort.signal);
        abort.abort(); await assert.rejects(child, /cancelled/);
    });
});

describe('Real FFmpeg playback delivery', function () {
    this.timeout(60000);
    let root: string; let service: PlaybackService; let file: File; let server: Server; let base: string;
    before(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-fixture-'));
        await fs.writeFile(path.join(root, 'subs.srt'), '1\n00:00:05,000 --> 00:00:07,000\nSubtitle after seek\n');
        await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x480:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-i', path.join(root, 'subs.srt'), '-t', '12', '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', '-g', '120', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-c:s', 'mov_text', path.join(root, 'fixture.mp4')]);
        service = new PlaybackService({ config: { ffmpeg: {}, streaming: { cacheDirectory: path.join(root, 'cache') }, transcoding: {} } } as unknown as Oblecto);
        file = { id: 1, path: path.join(root, 'fixture.mp4'), host: 'local', extension: 'mp4' } as File;
        const app = express();
        app.get('/:id/:revision/:asset', async (req, res) => {
            const session = service.get(req.params.id);
            await service.serve(session, Number(req.params.revision), req.params.asset, req, res);
        });
        app.use((error: PlaybackError, _req: express.Request, res: express.Response, _next: express.NextFunction) => { if (!res.headersSent) res.status(error.statusCode ?? 500).json({ code: error.code, message: error.message }); });
        server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });
    after(async () => { await service?.close(); await new Promise<void>(resolve => server?.close(() => resolve())); await fs.rm(root, { force: true, recursive: true }); });
    it('serves concurrent original ranges and HEAD without replacing destinations', async () => {
        const session = await service.create(file, 'alice', null, { subtitleMode: 'off' });
        assert.equal(session.plan.method, 'direct');
        const url = `${base}/${session.sessionId}/1/original`;
        const responses = await Promise.all([fetch(url, { headers: { Range: 'bytes=0-99' } }), fetch(url, { headers: { Range: 'bytes=-100' } })]);
        for (const response of responses) { assert.equal(response.status, 206); assert.equal((await response.arrayBuffer()).byteLength, 100); }
        const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal((await head.text()).length, 0);
        const invalid = await fetch(url, { headers: { Range: 'bytes=999999999-' } }); assert.equal(invalid.status, 416);
        assert.throws(() => service.get(session.sessionId, 'bob'), /unavailable/);
    });
    it('returns a path-free error when an original disappears after negotiation', async () => {
        const missing = path.join(root, 'removed.mp4');
        await fs.copyFile(file.path!, missing);
        const session = await service.create({ ...file, path: missing } as File, 'alice', null, {});
        await fs.unlink(missing);
        const response = await fetch(`${base}/${session.sessionId}/1/original`);
        assert.equal(response.status, 404);
        const body = await response.text();
        assert.match(body, /MEDIA_NOT_FOUND/);
        assert.ok(!body.includes(root));
        await service.stop(session);
    });
    it('renegotiates Emby bitrate without losing position and replaces expired leases', async () => {
        const emby = { sessions: { token: { Id: 1 } }, oblecto: { playback: service } } as unknown as EmbyEmulation;
        const request = (body: object = {}) => ({ headers: { 'x-emby-token': 'token' }, params: { mediaid: '1' }, query: {}, body }) as unknown as express.Request;
        const initial = request({ DeviceProfile: { DirectPlayProfiles: [{ Container: 'mp4', VideoCodec: 'h264', AudioCodec: 'aac' }] }, SubtitleStreamIndex: -1 });
        const [first, duplicate] = await Promise.all([embyPlayback(emby, initial, file, 'play'), embyPlayback(emby, request(), file, 'play')]);
        assert.equal(first.sessionId, duplicate.sessionId);
        assert.equal(first.plan.method, 'direct');
        first.position = 7;
        const updated = await embyPlayback(emby, request({ MaxStreamingBitrate: 1000000 }), file, 'play');
        assert.equal(updated.sessionId, first.sessionId);
        assert.equal(updated.position, 7);
        assert.equal(updated.plan.method, 'transcode');
        assert.equal(updated.revision, 2);
        assert.deepEqual(updated.plan.renditions.map(r => r.height), [360]);
        const reset = await embyPlayback(emby, request({ StartTimeTicks: 0 }), file, 'play');
        assert.equal(reset.position, 0);
        reset.updatedAt = 0;
        const replacement = await embyPlayback(emby, initial, file, 'play');
        assert.notEqual(replacement.sessionId, first.sessionId);
        assert.equal(service.sessions.has(first.sessionId), false);
        await service.stop(replacement);
    });
    it('tone-maps ten-bit HDR input to tagged eight-bit SDR output', async () => {
        const source = path.join(root, 'hdr.mkv');
        await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-t', '1', '-vf', 'format=yuv420p10le,setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc', '-c:v', 'ffv1', '-threads', '2', source]);
        const session = await service.create({ ...file, path: source, extension: 'mkv' } as File, 'alice', null, { quality: 'auto' });
        assert.equal(session.plan.method, 'transcode');
        assert.equal(session.plan.hdr, true);
        const rendition = session.plan.renditions[0];
        const response = await fetch(`${base}/${session.sessionId}/1/${rendition.id}-0.ts`);
        assert.equal(response.status, 200, await response.clone().text());
        const output = path.join(root, 'sdr.ts');
        await fs.writeFile(output, new Uint8Array(await response.arrayBuffer()));
        const metadata = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', output]));
        assert.equal(metadata.streams[0].pix_fmt, 'yuv420p');
        assert.equal(metadata.streams[0].color_transfer, 'bt709');
        assert.equal(metadata.streams[0].color_primaries, 'bt709');
        await service.stop(session);
    });
    it('generates seekable adaptive renditions and continuous segment timestamps', async () => {
        const session = await service.create(file, 'alice', null, { quality: 'auto', subtitleStreamIndex: 2 });
        const prefix = `${base}/${session.sessionId}/1`;
        const master = await (await fetch(`${prefix}/master.m3u8`)).text();
        assert.match(master, /360.m3u8/); assert.match(master, /480.m3u8/);
        const playlist = await (await fetch(`${prefix}/360.m3u8`)).text();
        assert.match(playlist, /PLAYLIST-TYPE:VOD/); assert.match(playlist, /360-2.ts/); assert.match(playlist, /ENDLIST/);
        for (const [variant, segment] of [['360', 0], ['480', 1], ['360', 2]] as const) {
            const response = await fetch(`${prefix}/${variant}-${segment}.ts`);
            assert.equal(response.status, 200, await response.clone().text());
            const output = path.join(root, `${variant}-${segment}.ts`);
            await fs.writeFile(output, new Uint8Array(await response.arrayBuffer()));
            const metadata = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
            const video = metadata.streams.find((stream: any) => stream.codec_type === 'video');
            const audio = metadata.streams.find((stream: any) => stream.codec_type === 'audio');
            assert.equal(video.height, Number(variant));
            assert.ok(Math.abs(Number(video.start_time) - segment * 4) < 0.15, `video timestamp ${video.start_time}`);
            assert.ok(Math.abs(Number(video.start_time) - Number(audio.start_time)) < 0.15, 'A/V drift');
        }
        const subtitles = await (await fetch(`${prefix}/subtitle.vtt`)).text();
        assert.match(subtitles, /00:05.000/); assert.match(subtitles, /Subtitle after seek/);
        await service.update(session, { subtitleMode: 'off', position: 6 }, 1);
        assert.equal(session.revision, 2); assert.equal(session.position, 6);
        assert.equal((await fetch(`${prefix}/360-0.ts`)).status, 409);
        await assert.rejects(service.report(session, { revision: 1, position: 5 }), /changed/);
        await service.stop(session); assert.throws(() => service.get(session.sessionId), /unavailable/);
    });
    it('burns styled subtitles at the correct absolute position after seeking', async () => {
        const source = path.join(root, 'styled.mkv');
        await run('ffmpeg', ['-v', 'error', '-y', '-i', file.path!, '-map', '0', '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'ass', source]);
        const styled = { ...file, id: 2, path: source, extension: 'mkv' } as File;
        const withSub = await service.create(styled, 'alice', null, { quality: 360, subtitleStreamIndex: 2 });
        const without = await service.create(styled, 'alice', null, { quality: 360, subtitleMode: 'off' });
        const hashes: string[] = [];
        for (const session of [withSub, without]) {
            const response = await fetch(`${base}/${session.sessionId}/1/360-1.ts`);
            assert.equal(response.status, 200, await response.clone().text());
            const output = path.join(root, `${session.sessionId}.ts`);
            await fs.writeFile(output, new Uint8Array(await response.arrayBuffer()));
            hashes.push(await run('ffmpeg', ['-v', 'error', '-i', output, '-ss', '1.5', '-frames:v', '1', '-f', 'md5', '-']));
            await service.stop(session);
        }
        assert.notEqual(hashes[0], hashes[1], 'Subtitle must be visible after the seek');
    });
    it('falls back once when a hardware encoder fails', async () => {
        const hardwareService = new PlaybackService({ config: { ffmpeg: {}, streaming: {}, transcoding: {} } } as unknown as Oblecto);
        // An unavailable encoder exercises real process failure independently of the host GPU.
        (hardwareService as unknown as { hardware: Promise<string> }).hardware = Promise.resolve('oblecto_missing_encoder');
        try {
            const session = await hardwareService.create(file, 'alice', null, { quality: 360, subtitleMode: 'off' });
            const app = express();
            app.get('/', (req, res) => hardwareService.serve(session, 1, '360-0.ts', req, res));
            const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
            try {
                const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
                assert.equal(response.status, 200); assert.ok((await response.arrayBuffer()).byteLength > 0);
                assert.equal(await (hardwareService as unknown as { hardware: Promise<null> }).hardware, null);
            } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
        } finally { await hardwareService.close(); }
    });
    it('regenerates evicted segments and serializes competing revisions', async () => {
        const session = await service.create(file, 'alice', null, { quality: 360, subtitleMode: 'off' });
        const url = `${base}/${session.sessionId}/1/360-0.ts`;
        const first = new Uint8Array(await (await fetch(url)).arrayBuffer());
        await Promise.allSettled(session.operations);
        await service.cache.remove(`${session.sessionId}/`);
        const next = new Uint8Array(await (await fetch(url)).arrayBuffer());
        const metadata = [];
        for (const [index, bytes] of [first, next].entries()) {
            const output = path.join(root, `regenerated-${index}.ts`);
            await fs.writeFile(output, bytes);
            metadata.push(JSON.parse(await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,start_time,width,height', '-of', 'json', output])));
        }
        assert.deepEqual(metadata[0], metadata[1], 'Regenerated segments preserve frame count, timestamps and dimensions');
        const results = await Promise.allSettled([service.update(session, { position: 3 }, 1), service.update(session, { position: 5 }, 1)]);
        assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
        session.updatedAt = Date.now() - 31 * 60 * 1000;
        assert.throws(() => service.get(session.sessionId), /unavailable/);
        await service.stop(session);
    });
    it('remuxes from verified keyframe boundaries', async () => {
        const session = await service.create(file, 'alice', null, { forceHls: true, subtitleMode: 'off' });
        assert.equal(session.plan.method, 'remux');
        const response = await fetch(`${base}/${session.sessionId}/1/source-1.ts`);
        assert.equal(response.status, 200); assert.ok((await response.arrayBuffer()).byteLength > 0);
    });
});
