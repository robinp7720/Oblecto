import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import { User } from '../../src/models/user.js';
import type { Server } from 'node:http';
import { File } from '../../src/models/file.js';
import config from '../../src/config.js';
import streamingRoutes from '../../src/submodules/REST/routes/streaming.js';
import { PlaybackService } from '../../src/lib/playback/PlaybackService.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';
import { setTimeout as delay } from 'node:timers/promises';

describe('Playback session REST API', () => {
    let server: Server; let service: PlaybackService; let base: string;
    let directory: string;
    const originalBytes = Buffer.from('original source bytes, including all embedded tracks');
    const findFile = File.findByPk;
    const findUser = User.findByPk;
    const token = (id = 1) => issueAccessToken({ id, password: null }, config.authentication);
    const headers = (id = 1) => ({ Authorization: `Bearer ${token(id)}`, 'Content-Type': 'application/json' });
    before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-direct-api-'));
        const source = path.join(directory, 'source.mkv');
        await fs.writeFile(source, originalBytes);
        service = new PlaybackService({ config: { ffmpeg: {}, streaming: {}, transcoding: {} } } as unknown as Oblecto);
        service.probe = async file => file.id === 2
            ? { path: source, duration: 90, size: originalBytes.length, container: 'mkv', streams: [
                { index: 0, codec_type: 'video', codec_name: 'hevc' },
                { index: 1, codec_type: 'audio', codec_name: 'ac3', channels: 6 },
                { index: 2, codec_type: 'subtitle', codec_name: 'ass', disposition: { forced: 1 } }
            ] }
            : { path: '/not-used.mp4', duration: 90, size: 100000, container: 'mp4', streams: [{ index: 0, codec_type: 'video', codec_name: 'h264' }, { index: 1, codec_type: 'audio', codec_name: 'aac' }] };
        User.findByPk = (async (id: number) => ({ id, password: null }) as User) as typeof User.findByPk;
        File.findByPk = (async (id: number) => id === 1
            ? { id: 1, path: '/not-used.mp4', host: 'local', extension: 'mp4' } as File
            : id === 2 ? { id: 2, path: source, host: 'local', extension: 'mkv' } as File : null) as typeof File.findByPk;
        const app = express(); app.use(express.json());
        app.use((req: OblectoRequest, _res, next) => { if (req.headers.authorization) req.authorization = { scheme: 'Bearer', credentials: req.headers.authorization.split(' ')[1] }; next(); });
        streamingRoutes(app, { playback: service } as unknown as Oblecto);
        app.use((error: { statusCode?: number; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.statusCode ?? 500).send({ message: error.message }));
        server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });
    after(async () => { File.findByPk = findFile; User.findByPk = findUser; await service.close(); await new Promise<void>(resolve => server.close(() => resolve())); await fs.rm(directory, { recursive: true, force: true }); });
    it('requires authentication and removes legacy session routes', async () => {
        assert.equal((await fetch(`${base}/playback/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fileId":1}' })).status, 401);
        assert.equal((await fetch(`${base}/session/create/1`, { headers: headers() })).status, 404);
    });
    it('negotiates a session, validates selections, and protects ownership', async () => {
        const response = await fetch(`${base}/playback/sessions`, { method: 'POST', headers: headers(), body: JSON.stringify({ fileId: 1, position: 12.5 }) });
        assert.equal(response.status, 201);
        const session = await response.json();
        assert.equal(session.method, 'direct'); assert.equal(session.position, 12.5);
        assert.equal(session.selectedTracks.audioStreamIndex, 1); assert.ok(session.mediaUrl.includes('token='));
        assert.equal((await fetch(`${base}/playback/sessions/${session.sessionId}`, { headers: headers(2) })).status, 404);
        assert.equal((await fetch(`${base}/playback/sessions/${session.sessionId}`, { method: 'DELETE', headers: headers(2) })).status, 404);
        assert.equal((await fetch(`${base}/playback/media/${session.sessionId}/1/original`)).status, 401);
        assert.equal((await fetch(`${base}/playback/sessions/${session.sessionId}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ revision: 1, audioStreamIndex: 900 }) })).status, 400);
        assert.equal(service.get(session.sessionId).revision, 1);
        const updated = await fetch(`${base}/playback/sessions/${session.sessionId}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ revision: 1, subtitleMode: 'off', position: 15 }) });
        assert.equal(updated.status, 200); assert.equal((await updated.json()).revision, 2);
        const stale = await fetch(`${base}/playback/sessions/${session.sessionId}/progress`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: 1, position: 15 }) });
        assert.equal(stale.status, 409);
        for (let i = 0; i < 2; i++) assert.equal((await fetch(`${base}/playback/sessions/${session.sessionId}`, { method: 'DELETE', headers: headers() })).status, 204);
        assert.equal((await fetch(`${base}${session.mediaUrl}`)).status, 404);
    });
    it('rejects negative/fractional tracks, offsets and malformed capability lists', async () => {
        for (const extra of [{ position: -1 }, { audioStreamIndex: 1.5 }, { subtitleStreamIndex: -1 }, { subtitleMode: 'invalid' }, { capabilities: { containers: 'mp4' } }]) {
            const response = await fetch(`${base}/playback/sessions`, { method: 'POST', headers: headers(), body: JSON.stringify({ fileId: 1, ...extra }) });
            assert.equal(response.status, 400);
        }
    });
    it('returns a protected direct HTTP URL for an original MKV with range and HEAD support', async () => {
        const response = await fetch(`${base}/playback/sessions`, { method: 'POST', headers: headers(), body: JSON.stringify({ fileId: 2, forceDirect: true }) });
        assert.equal(response.status, 201);
        const session = await response.json();
        assert.equal(session.method, 'direct');
        assert.match(session.mediaUrl, /\/original\?token=/);
        assert.equal(session.subtitleUrl, null);
        const url = `${base}${session.mediaUrl}`;
        assert.equal((await fetch(url.replace(/token=.*/, 'token=wrong'))).status, 401);
        const full = await fetch(url);
        assert.equal(full.status, 200);
        assert.deepEqual(Buffer.from(await full.arrayBuffer()), originalBytes);
        const range = await fetch(url, { headers: { Range: 'bytes=9-14' } });
        assert.equal(range.status, 206);
        assert.equal(range.headers.get('content-range'), `bytes 9-14/${originalBytes.length}`);
        assert.deepEqual(Buffer.from(await range.arrayBuffer()), originalBytes.subarray(9, 15));
        const head = await fetch(url, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(head.headers.get('content-length'), String(originalBytes.length));
        assert.equal(await head.text(), '');
        for (const asset of ['master.m3u8', 'source-0.ts', 'subtitle-2.vtt']) {
            assert.equal((await fetch(url.replace('/original?', `/${asset}?`))).status, 404);
        }
        assert.equal(service.cache.bytes, 0);
        await fetch(`${base}/playback/sessions/${session.sessionId}`, { method: 'DELETE', headers: headers() });
        assert.equal((await fetch(url)).status, 404);
    });
    it('includes lookup and probe time, waits for a successful media byte, and accepts browser startup once', async () => {
        const probe = service.probe.bind(service);
        const create = service.create.bind(service);
        const lookup = File.findByPk;
        // This API fixture has no catalogue database; ownership still uses the authenticated owner.
        service.create = (file, owner, _userId, options, id, at) => create(file, owner, null, options, id, at);
        File.findByPk = (async (...args) => { await delay(20); return lookup(...args); }) as typeof File.findByPk;
        service.probe = async source => { await delay(20); return probe(source); };
        try {
            const response = await fetch(`${base}/playback/sessions`, { method: 'POST', headers: headers(), body: JSON.stringify({ fileId: 2, forceDirect: true }) });
            const descriptor = await response.json();
            assert.ok(descriptor.timings.lookupMs >= 15);
            assert.ok(descriptor.timings.probeMs >= 15);
            assert.ok(descriptor.timings.preparationMs >= descriptor.timings.lookupMs + descriptor.timings.probeMs);
            const session = service.get(descriptor.sessionId);
            assert.equal(session.startupMs, null);
            const url = `${base}${descriptor.mediaUrl}`;
            await fetch(url, { method: 'HEAD' });
            assert.equal(session.startupMs, null);
            assert.equal((await fetch(url, { headers: { Range: 'bytes=999999999-' } })).status, 416);
            assert.equal(session.startupMs, null);
            await (await fetch(url, { headers: { Range: 'bytes=0-2' } })).arrayBuffer();
            assert.ok(session.startupMs! >= descriptor.timings.preparationMs - 1);
            assert.equal(session.timings.firstMediaMs, session.startupMs);
            for (const firstPlaybackMs of [-1, 'bad', 800, 900]) {
                assert.equal((await fetch(`${base}/playback/sessions/${session.sessionId}/progress`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: 1, position: 0, paused: false, firstPlaybackMs }) })).status, 204);
            }
            assert.equal(session.timings.firstPlaybackMs, 800);
            for (const extra of [
                { bufferedSeconds: 12, rebufferDurationMs: 200 },
                { bufferedSeconds: -1, rebufferDurationMs: 100 },
                { bufferedSeconds: 'bad', rebufferDurationMs: 'bad' }
            ]) {
                assert.equal((await fetch(`${base}/playback/sessions/${session.sessionId}/progress`, { method: 'POST', headers: headers(), body: JSON.stringify({ revision: 1, position: 0, ...extra }) })).status, 204);
            }
            assert.equal(session.delivery.bufferedSeconds, 12);
            assert.equal(session.delivery.rebufferDurationMs, 200);
            await service.stop(session);
        } finally { File.findByPk = lookup; service.probe = probe; service.create = create; }
    });
});
