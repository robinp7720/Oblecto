import { PeerRPC, connectTLS } from '../../src/lib/federation/protocol.js';
import assert from 'node:assert/strict';
import { fork, execFile, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { randomUUID } from 'node:crypto';

async function freePort() { const server = net.createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const port = (server.address() as net.AddressInfo).port; await new Promise<void>(resolve => server.close(() => resolve())); return port; }
function request(child: ChildProcess, op: string, args?: unknown): Promise<any> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
        const receive = (message: any) => { if (message.id !== id) return; clearTimeout(timer); child.removeListener('message', receive); if (message.error) reject(new Error(message.error)); else resolve(message.value); };
        const timer = setTimeout(() => { child.removeListener('message', receive); reject(new Error(`Timed out: ${op}`)); }, 15000);
        child.on('message', receive); child.send({ id, op, args });
    });
}
async function until(check: () => Promise<boolean>, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('Condition did not become true');
}
describe('Two isolated federation servers', function () {
    this.timeout(60000);
    let directory: string; let a: ChildProcess; let b: ChildProcess; let invitation: any;
    const children: ChildProcess[] = []; let logs = '';
    before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-federation-pair-'));
        const media = path.join(directory, 'source.mp4');
        await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30', '-t', '2', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', media]);
        for (const [index, name] of ['alpha', 'beta'].entries()) {
            const root = path.join(directory, name); await fs.mkdir(root);
            const key = path.join(root, 'key.pem'); const cert = path.join(root, 'cert.pem');
            await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '1']);
            const config = JSON.parse(await fs.readFile('tests/fixtures/config.json', 'utf8'));
            config.database = { dialect: 'sqlite', storage: path.join(root, 'db.sqlite') };
            config.federation = { uuid: name, enable: true, address: '127.0.0.1', key, cert, dataPort: await freePort(), mediaPort: await freePort(), servers: {}, clients: {}, syncIntervalMs: 900000 };
            config.streaming = { cacheDirectory: path.join(root, 'cache') };
            const configPath = path.join(root, 'config.json'); await fs.writeFile(configPath, JSON.stringify(config));
            const child = fork('tests/helpers/federationServer.ts', { execArgv: ['--import=tsx'], env: { ...process.env, OBLECTO_CONFIG_PATH: configPath, FEDERATION_TEST_MEDIA: media, FEDERATION_TEST_MOVIE: String(index + 1) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
            children.push(child); child.stdout?.on('data', data => { logs += String(data); }); child.stderr?.on('data', data => { logs += String(data); });
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(logs)), 15000);
                child.once('exit', code => { clearTimeout(timer); reject(new Error(`Child exited ${code}: ${logs}`)); });
                child.on('message', (message: any) => { if (message.ready) { clearTimeout(timer); resolve(); } });
            });
        }
        [a, b] = children;
    });
    after(async () => {
        for (const child of children) {
            if (child.connected) await request(child, 'close').catch(() => {});
            child.kill('SIGTERM');
        }
        await fs.rm(directory, { recursive: true, force: true });
    });
    it('pairs mutually, synchronizes both catalogs and plays origin-owned media', async () => {
        invitation = await request(a, 'invite');
        const attempts = await Promise.all([request(b, 'pair', invitation.invitation), request(b, 'pair', invitation.invitation)]);
        assert.equal(attempts[0], attempts[1]);
        try {
            await until(async () => (await request(a, 'status')).pairings.some((p: any) => p.state === 'active') && (await request(b, 'status')).pairings.some((p: any) => p.state === 'active'));
            await until(async () => (await request(a, 'files')).length === 2 && (await request(b, 'files')).length === 2);
        } catch (error) { throw new Error(`${String(error)}\n${JSON.stringify(await request(a, 'status'))}\n${JSON.stringify(await request(b, 'status'))}\n${logs}`); }
        assert.equal((await request(b, 'play', 'alpha')).remote, true);
        assert.equal((await request(a, 'play', 'beta')).remote, true);
    });
    it('restores durable peer state and unconsumed invitation hashes after restart', async () => {
        const extra = await request(a, 'invite');
        await request(a, 'restart'); await request(b, 'restart');
        await until(async () => (await request(a, 'status')).peers[0].state === 'connected' && (await request(b, 'status')).peers[0].state === 'connected');
        assert.equal((await request(a, 'status')).pairings[0].state, 'active');
        await request(b, 'pair', extra.invitation);
        await until(async () => (await request(b, 'status')).pairings.some((p: any) => p.id === extra.id && p.state === 'active'));
    });
    it('rejects catalog access before authentication, old protocols and callback proof reflection', async () => {
        const configs = await Promise.all(['alpha', 'beta'].map(async name => JSON.parse(await fs.readFile(path.join(directory, name, 'config.json'), 'utf8'))));
        const [ac, bc] = configs.map(config => config.federation);
        const arpc = new PeerRPC(await connectTLS(ac.address, ac.dataPort, await fs.readFile(ac.cert, 'utf8')));
        const brpc = new PeerRPC(await connectTLS(bc.address, bc.dataPort, await fs.readFile(bc.cert, 'utf8')));
        try {
            await assert.rejects(arpc.request('hello', { version: 1 }), /Upgrade both/);
            const hello: any = await arpc.request('hello', { version: 2 });
            await assert.rejects(arpc.request('snapshot.start'), /authentication required/);
            await brpc.request('hello', { version: 2 });
            const callback: any = await brpc.request('identity', { nonce: hello.nonce });
            await assert.rejects(arpc.request('authenticate', { uuid: 'beta', signature: callback.signature }), /authentication failed/);
        } finally { arpc.close(); brpc.close(); }
    });
    it('keeps repeated pending pairing requests cancellable', async () => {
        const pending = await request(a, 'invite');
        await request(a, 'config', { enable: false });
        const ids = await Promise.all([request(b, 'pair', pending.invitation), request(b, 'pair', pending.invitation)]);
        assert.equal(ids[0], ids[1]);
        await request(b, 'cancelPairing', ids[0]);
        await request(a, 'config', { enable: true });
        await assert.rejects(request(b, 'pair', pending.invitation), /cancelled/);
        assert.equal((await request(b, 'status')).pairings.find((p: any) => p.id === ids[0]).state, 'cancelled');
    });
    it('keeps cached files during an outage and applies live recovery', async () => {
        await request(a, 'config', { enable: false }); await request(b, 'sync', 'alpha');
        await until(async () => (await request(b, 'status')).peers[0].state === 'error');
        assert.equal((await request(b, 'files')).length, 2);
        await request(a, 'config', { enable: true }); await request(b, 'sync', 'alpha');
        await until(async () => (await request(b, 'status')).peers[0].state === 'connected');
    });
    it('reconciles confirmed remote deletion while retaining the local file', async () => {
        await request(a, 'deleteLocal'); await request(b, 'sync', 'alpha');
        await until(async () => (await request(b, 'files')).length === 1);
        assert.equal((await request(b, 'files'))[0].host, 'local');
    });
    it('revokes access immediately and rejects revoked invitations', async () => {
        const next = await request(a, 'invite'); await request(a, 'revokeInvitation', next.id);
        await request(b, 'remove', 'alpha');
        await assert.rejects(request(b, 'play', 'alpha'), /disabled|unavailable|configured|No imported/);
        await request(b, 'pair', next.invitation);
        await until(async () => (await request(b, 'status')).pairings.some((p: any) => p.id === next.id && p.error));
        assert.equal((await request(b, 'status')).peers.length, 0);
    });
});
