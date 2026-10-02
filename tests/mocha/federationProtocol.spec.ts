import assert from 'node:assert/strict';
import tls from 'node:tls';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { PeerRPC, connectTLS } from '../../src/lib/federation/protocol.js';
import { checkProof, proof, validateIdentity } from '../../src/lib/federation/identity.js';
import { FramedPeer } from '../../src/lib/federation/frames.js';

describe('Federation v2 transport and identities', function () {
    this.timeout(15000);
    let directory: string; let key: string; let cert: string; let server: tls.Server; let port: number;
    const sockets = new Set<tls.TLSSocket>();
    before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-federation-'));
        const keyPath = path.join(directory, 'key'); const certPath = path.join(directory, 'cert');
        await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '1']);
        key = await fs.readFile(keyPath, 'utf8'); cert = await fs.readFile(certPath, 'utf8');
        server = tls.createServer({ key, cert }, socket => {
            sockets.add(socket); socket.once('close', () => sockets.delete(socket));
            new PeerRPC(socket, async (op, payload) => {
                if (op === 'slow') { await new Promise(resolve => setTimeout(resolve, 100)); return {}; }
                if (op !== 'echo') throw new Error('Unsupported operation'); return payload;
            });
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        port = (server.address() as any).port;
    });
    after(async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); await fs.rm(directory, { recursive: true, force: true }); });
    it('round-trips framed requests and rejects unsupported operations', async () => {
        const rpc = new PeerRPC(await connectTLS('127.0.0.1', port, cert));
        try { assert.deepEqual(await rpc.request('echo', { text: 'a:b\nü' }), { text: 'a:b\nü' }); await assert.rejects(rpc.request('other'), /Unsupported/); }
        finally { rpc.close(); }
    });
    it('rejects untrusted certificates', async () => { await assert.rejects(connectTLS('127.0.0.1', port, ''), /certificate/i); });
    it('pins the exact peer certificate', async () => { await assert.rejects(connectTLS('127.0.0.1', port, cert, '00:00'), /certificate changed/); });
    it('rejects outstanding calls on deadlines and disconnect', async () => {
        const rpc = new PeerRPC(await connectTLS('127.0.0.1', port, cert));
        await assert.rejects(rpc.request('slow', {}, 10), /timed out/);
        const second = new PeerRPC(await connectTLS('127.0.0.1', port, cert));
        const pending = second.request('slow'); second.close(); await assert.rejects(pending, /closed|write/i);
    });
    it('handles fragmented and coalesced frames', async () => {
        const socket = await connectTLS('127.0.0.1', port, cert); const responses: unknown[] = [];
        let finish!: () => void; const done = new Promise<void>(resolve => { finish = resolve; });
        new FramedPeer(socket, message => { responses.push(message.payload); if (responses.length === 2) finish(); });
        const frame = (id: string) => { const body = Buffer.from(JSON.stringify({ id, op: 'echo', payload: id })); const prefix = Buffer.alloc(8); prefix.writeUInt32BE(body.length + 4); prefix.writeUInt32BE(body.length, 4); return Buffer.concat([prefix, body]); };
        const first = frame('first'); socket.write(first.subarray(0, 3)); socket.write(Buffer.concat([first.subarray(3), frame('second')]));
        await done; assert.deepEqual(responses, ['first', 'second']); socket.destroy();
    });
    it('closes malformed and oversized frames', async () => {
        for (const frame of [Buffer.from([0, 32, 0, 0, 0, 0, 0, 2]), Buffer.from([0, 0, 0, 8, 0, 0, 0, 4, 110, 117, 108, 108])]) {
            const socket = await connectTLS('127.0.0.1', port, cert); socket.on('error', () => {});
            const closed = new Promise(resolve => socket.once('close', resolve)); socket.write(frame); await closed;
        }
    });
    it('separates callback proof from authentication proof', () => {
        const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
        const signature = proof(key, 'nonce', 'callback');
        assert.equal(checkProof(cert, 'nonce', signature), false);
        assert.equal(checkProof(cert, 'nonce', signature, 'callback'), true);
        assert.equal(checkProof(publicKey, 'nonce', signature, 'callback'), false);
        assert.throws(() => validateIdentity({ uuid: 'local', address: '127.0.0.1', dataPort: 9131, mediaPort: 9132, certificate: cert, publicKey }));
    });
});
