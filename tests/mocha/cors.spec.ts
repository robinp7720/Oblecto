import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { corsFor } from '../../src/lib/network/cors.js';

describe('Cross-origin access', () => {
    let server: Server;
    let base: string;
    const settings: { corsOrigins?: string[] } = {};

    before(async () => {
        const app = express();

        app.use(corsFor(() => settings, { allowed: ['Authorization', 'Content-Type'], exposed: ['Content-Range'] }));
        app.post('/auth/login', (_req, res) => { res.send({ ok: true }); });
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(() => new Promise(resolve => server.close(resolve)));

    const preflight = (origin: string) => fetch(`${base}/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    });

    it('gives other websites no access by default', async () => {
        settings.corsOrigins = [];
        assert.equal((await preflight('https://evil.example')).headers.get('access-control-allow-origin'), null);
    });

    it('allows the listed origins, and only those', async () => {
        settings.corsOrigins = ['http://localhost:5173'];
        assert.equal((await preflight('http://localhost:5173')).headers.get('access-control-allow-origin'), 'http://localhost:5173');
        assert.equal((await preflight('https://evil.example')).headers.get('access-control-allow-origin'), null);
    });

    it('allows any origin only when asked to with *', async () => {
        settings.corsOrigins = ['*'];
        assert.equal((await preflight('https://anywhere.example')).headers.get('access-control-allow-origin'), 'https://anywhere.example');
    });

    it('leaves same-origin requests, which send no Origin, alone', async () => {
        settings.corsOrigins = [];
        assert.equal((await fetch(`${base}/auth/login`, { method: 'POST' })).status, 200);
    });
});
