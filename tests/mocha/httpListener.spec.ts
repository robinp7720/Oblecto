import assert from 'node:assert/strict';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';
import { connect } from 'node:net';
import { setImmediate } from 'node:timers/promises';
import { HttpListener } from '../../src/submodules/httpListener.js';

describe('HTTP listener lifecycle', () => {
    it('does not bind in the constructor and resolves startup only when listening', async () => {
        const listener = new HttpListener((_req, res) => { res.end('ready'); });
        assert.equal(listener.server.listening, false);
        try {
            const starting = listener.start({ port: 0, host: '127.0.0.1' });
            assert.equal(listener.start({ port: 0 }), starting);
            await starting;
            assert.equal(listener.server.listening, true);
            const { port } = listener.server.address() as AddressInfo;
            assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'ready');
        } finally { await listener.close(); }
        await listener.close();
        assert.equal(listener.server.listening, false);
        await assert.rejects(listener.start({ port: 0 }), /stopped/);
    });

    it('rejects an occupied port through startup and can close after failure', async () => {
        const first = new HttpListener((_req, res) => { res.end(); });
        const second = new HttpListener((_req, res) => { res.end(); });
        try {
            await first.start({ port: 0, host: '127.0.0.1' });
            const { port } = first.server.address() as AddressInfo;
            await assert.rejects(second.start({ port, host: '127.0.0.1' }), { code: 'EADDRINUSE' });
        } finally {
            await second.close();
            await first.close();
        }
    });

    it('stops intake while waiting for an active response to finish', async () => {
        const entered = Promise.withResolvers<void>();
        const release = Promise.withResolvers<void>();
        const listener = new HttpListener((_req, res) => {
            entered.resolve();
            void release.promise.then(() => { res.end('finished'); });
        });
        await listener.start({ port: 0, host: '127.0.0.1' });
        const { port } = listener.server.address() as AddressInfo;
        const response = new Promise<string>((resolve, reject) => {
            get(`http://127.0.0.1:${port}`, { agent: false }, res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => { body += chunk; });
                res.on('end', () => resolve(body));
                res.on('error', reject);
            }).on('error', reject);
        });
        try {
            await entered.promise;
            listener.stop();
            let closed = false;
            const closing = listener.close().then(() => { closed = true; });
            await setImmediate();
            assert.equal(listener.server.listening, false);
            assert.equal(closed, false);
            release.resolve();
            assert.equal(await response, 'finished');
            await closing;
        } finally {
            release.resolve();
            await listener.close();
        }
    });

    it('can close during binding without leaving a late listener open', async () => {
        const listener = new HttpListener((_req, res) => { res.end(); });
        const starting = listener.start({ port: 0, host: '127.0.0.1' });
        await Promise.all([starting, listener.close()]);
        assert.equal(listener.server.listening, false);
    });

    it('rejects a pipelined request on an existing connection after intake stops', async () => {
        let handled = 0;
        const listener = new HttpListener((_req, res) => {
            handled++;
            res.writeHead(200, { 'Content-Length': 5 });
            res.end('first');
            listener.stop();
        });
        await listener.start({ port: 0, host: '127.0.0.1' });
        const { port } = listener.server.address() as AddressInfo;
        const socket = connect(port, '127.0.0.1');
        try {
            const response = await new Promise<string>((resolve, reject) => {
                let data = '';
                socket.setEncoding('utf8');
                socket.on('data', (chunk: string) => { data += chunk; });
                socket.on('error', reject);
                socket.on('end', () => resolve(data));
                socket.on('connect', () => socket.write(
                    'GET /first HTTP/1.1\r\nHost: localhost\r\n\r\nGET /late HTTP/1.1\r\nHost: localhost\r\n\r\n'
                ));
            });
            assert.equal(handled, 1);
            assert.match(response, /HTTP\/1.1 200/);
            assert.match(response, /HTTP\/1.1 503/);
            assert.match(response, /Server is shutting down/);
        } finally {
            socket.destroy();
            await listener.close();
        }
    });
});
