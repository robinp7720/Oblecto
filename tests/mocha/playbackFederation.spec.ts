import assert from 'node:assert/strict';
import tls from 'node:tls';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import type { Server } from 'node:http';
import { File } from '../../src/models/file.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import { PlaybackService } from '../../src/lib/playback/PlaybackService.js';
import { acceptPlaybackPeer, connectPlaybackPeer, FramedPeer } from '../../src/lib/playback/federation.js';
import { run } from '../../src/lib/playback/process.js';

describe('Federated playback protocol', function () {
    this.timeout(60000);
    let directory: string; let origin: any; let receiver: any; let peerServer: tls.Server; let http: Server; let base: string;
    const find = File.findByPk;
    before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-peer-test-'));
        const key = path.join(directory, 'key.pem'); const cert = path.join(directory, 'cert.pem');
        await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '1']);
        await run('openssl', ['pkey', '-in', key, '-pubout', '-out', path.join(directory, 'public.pem')]);
        await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30', '-t', '10', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', '-pix_fmt', 'yuv420p', path.join(directory, 'source.mp4')]);
        const localFile = { id: 7, path: path.join(directory, 'source.mp4'), host: 'local', extension: 'mp4' } as File;
        File.findByPk = (async id => Number(id) === 7 ? localFile : null) as typeof File.findByPk;
        origin = { config: { ffmpeg: {}, streaming: {}, transcoding: {}, federation: { clients: { receiver: { key: path.join(directory, 'public.pem') } } } } };
        origin.playback = new PlaybackService(origin);
        peerServer = tls.createServer({ key: await fs.readFile(key), cert: await fs.readFile(cert) }, socket => acceptPlaybackPeer(origin, socket));
        peerServer.listen(0, '127.0.0.1'); await new Promise<void>(resolve => peerServer.once('listening', resolve));
        receiver = { config: { ffmpeg: {}, streaming: {}, transcoding: {}, federation: { uuid: 'receiver', key, servers: { origin: { address: '127.0.0.1', mediaPort: (peerServer.address() as { port: number }).port, ca: cert } } } } };
        receiver.playback = new PlaybackService(receiver);
        receiver.playback.remoteFactory = (host: string) => connectPlaybackPeer(receiver, host);
        const app = express();
        app.get('/playback/media/:id/:revision/:asset', async (req, res) => {
            const s = receiver.playback.get(req.params.id);
            await receiver.playback.serve(s, Number(req.params.revision), req.params.asset, req, res);
        });
        app.use((err: any, _req: any, res: any, _next: any) => { if (!res.headersSent) res.status(err.statusCode || 500).json({ message: err.message }); });
        http = app.listen(0); await new Promise<void>(resolve => http.once('listening', resolve));
        base = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
    });
    after(async () => {
        File.findByPk = find;
        await receiver?.playback.close(); await origin?.playback.close();
        await Promise.all([new Promise<void>(resolve => http?.close(() => resolve())), new Promise<void>(resolve => peerServer?.close(() => resolve()))]);
        await fs.rm(directory, { force: true, recursive: true });
    });
    it('proxies ranges without local transcoding and isolates remote sessions', async () => {
        const file = { id: 8, host: 'origin', path: '7' } as File;
        const s = await receiver.playback.create(file, 'viewer:1', null, {});
        const description = receiver.playback.describe(s);
        const response = await fetch(`${base}${description.mediaUrl}`, { headers: { Range: 'bytes=0-99' } });
        assert.equal(response.status, 206, await response.clone().text()); assert.equal((await response.arrayBuffer()).byteLength, 100);
        assert.equal(receiver.playback.scheduler.active, 0); assert.equal(receiver.playback.cache.bytes, 0);
        assert.equal(origin.playback.sessions.size, 1);
        await assert.rejects(s.remote.client.request('heartbeat', { sessionId: 'unknown' }), /unavailable/);
        await receiver.playback.stop(s); assert.equal(origin.playback.sessions.size, 0);
    });
    it('rewrites playlist tokens, supports remote quality changes, and closes both sessions', async () => {
        const s = await receiver.playback.create({ id: 8, host: 'origin', path: '7' } as File, 'viewer:1', null, { quality: 'auto' });
        const description = receiver.playback.describe(s);
        const master = await (await fetch(`${base}${description.mediaUrl}`)).text();
        assert.ok(master.includes(`token=${s.token}`), master);
        const name = master.split('\n').find((line: string) => line && !line.startsWith('#'));
        const playlistURL = new URL(name!, `${base}${description.mediaUrl}`);
        const playlist = await (await fetch(playlistURL)).text();
        const segment = playlist.split('\n').find((line: string) => line.includes('-1.ts'));
        const response = await fetch(new URL(segment!, playlistURL));
        assert.equal(response.status, 200, await response.clone().text()); assert.ok((await response.arrayBuffer()).byteLength > 100);
        await receiver.playback.update(s, { position: 6, quality: 360 }, 1);
        assert.equal(s.revision, 2);
        await receiver.playback.stop(s); assert.equal(origin.playback.sessions.size, 0);
    });
    it('rejects incompatible peer protocol versions', async () => {
        const socket = tls.connect({ host: '127.0.0.1', port: (peerServer.address() as { port: number }).port, ca: await fs.readFile(path.join(directory, 'cert.pem')) });
        const response = new Promise<any>(resolve => {
            const peer = new FramedPeer(socket, message => { resolve(message); socket.destroy(); });
            socket.once('secureConnect', () => { void peer.send({ op: 'hello', payload: { version: 0, clientId: 'receiver' } }); });
        });
        assert.equal((await response).code, 'REMOTE_PROTOCOL');
    });
});
