import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
import { File } from '../../src/models/file.js';
import config from '../../src/config.js';
import streamingRoutes from '../../src/submodules/REST/routes/streaming.js';
import { PlaybackService } from '../../src/lib/playback/PlaybackService.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';

describe('Playback session REST API', () => {
    let server: Server; let service: PlaybackService; let base: string;
    const findFile = File.findByPk;
    const token = (id = 1) => jwt.sign({ id }, config.authentication.secret);
    const headers = (id = 1) => ({ Authorization: `Bearer ${token(id)}`, 'Content-Type': 'application/json' });
    before(async () => {
        service = new PlaybackService({ config: { ffmpeg: {}, streaming: {}, transcoding: {} } } as unknown as Oblecto);
        service.probe = async () => ({ path: '/not-used.mp4', duration: 90, size: 100000, container: 'mp4', streams: [{ index: 0, codec_type: 'video', codec_name: 'h264' }, { index: 1, codec_type: 'audio', codec_name: 'aac' }] });
        File.findByPk = (async (id: number) => id === 1 ? { id: 1, path: '/not-used.mp4', host: 'local', extension: 'mp4' } as File : null) as typeof File.findByPk;
        const app = express(); app.use(express.json());
        app.use((req: OblectoRequest, _res, next) => { if (req.headers.authorization) req.authorization = { scheme: 'Bearer', credentials: req.headers.authorization.split(' ')[1] }; next(); });
        streamingRoutes(app, { playback: service } as unknown as Oblecto);
        app.use((error: { statusCode?: number; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.statusCode ?? 500).send({ message: error.message }));
        server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });
    after(async () => { File.findByPk = findFile; await service.close(); await new Promise<void>(resolve => server.close(() => resolve())); });
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
});
