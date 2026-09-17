import assert from 'node:assert/strict';

import DeviceRegistry from '../../src/lib/realtime/DeviceRegistry.js';
import statusRoutes from '../../src/submodules/REST/routes/v1/status.js';

import type { Express, Request, Response } from 'express';
import type { Socket } from 'socket.io';
import type Oblecto from '../../src/lib/oblecto/index.js';

type Handler = (req: Request, res: Response) => void;

/**
 * Captures the handler the route module registers, so it can be called
 * directly with hand-rolled request and response stubs.
 */
function handlerFor(path: string, oblecto: Oblecto): Handler {
    let handler: Handler | null = null;

    const server = {
        get(registeredPath: string, ...rest: unknown[]) {
            if (registeredPath === path) handler = rest[rest.length - 1] as Handler;
        },
        post() { /* not under test */ }
    } as unknown as Express;

    statusRoutes(server, oblecto);

    assert.ok(handler, `no handler registered for ${path}`);

    return handler;
}

function buildOblecto(): { oblecto: Oblecto; registry: DeviceRegistry<Socket> } {
    const registry = new DeviceRegistry<Socket>();
    const oblecto = { realTimeController: { registry } } as unknown as Oblecto;

    return {
        oblecto,
        registry
    };
}

const request = (userId?: number) => ({ authorization: userId === undefined ? {} : { user: { id: userId } } }) as unknown as Request;

function captureResponse(): { res: Response; body: () => unknown } {
    let sent: unknown = undefined;
    const res = { send: (payload: unknown) => { sent = payload; } } as unknown as Response;

    return {
        res,
        body: () => sent
    };
}

describe('GET /api/v1/status/clients', () => {
    it('returns only the calling user\'s devices', () => {
        const { oblecto, registry } = buildOblecto();

        registry.register(1, {
            deviceId: 'mine',
            name: 'My laptop',
            capabilities: ['control', 'playback']
        }, {} as Socket);

        registry.register(2, {
            deviceId: 'theirs',
            name: 'Their TV',
            capabilities: ['control', 'playback']
        }, {} as Socket);

        const { res, body } = captureResponse();

        handlerFor('/api/v1/status/clients', oblecto)(request(1), res);

        const clients = body() as { deviceId: string }[];

        assert.deepEqual(clients.map(client => client.deviceId), ['mine']);
    });

    it('does not leak JWT payload fields beyond the user id', () => {
        const { oblecto, registry } = buildOblecto();

        registry.register(1, {
            deviceId: 'mine',
            name: 'My laptop',
            capabilities: ['control', 'playback']
        }, {} as Socket);

        const { res, body } = captureResponse();

        handlerFor('/api/v1/status/clients', oblecto)(request(1), res);

        const [client] = body() as { user: Record<string, unknown> }[];

        assert.deepEqual(Object.keys(client.user), ['id']);
    });

    it('reports the device name rather than a socket id', () => {
        const { oblecto, registry } = buildOblecto();

        registry.register(1, {
            deviceId: 'mine',
            name: 'Living room TV',
            capabilities: ['control', 'playback']
        }, {} as Socket);

        const { res, body } = captureResponse();

        handlerFor('/api/v1/status/clients', oblecto)(request(1), res);

        const [client] = body() as { name: string }[];

        assert.equal(client.name, 'Living room TV');
        assert.notEqual(client.name, 'default');
    });

    it('returns an empty list when the request carries no user', () => {
        const { oblecto, registry } = buildOblecto();

        registry.register(1, {
            deviceId: 'mine',
            name: 'My laptop',
            capabilities: ['control', 'playback']
        }, {} as Socket);

        const { res, body } = captureResponse();

        handlerFor('/api/v1/status/clients', oblecto)(request(), res);

        assert.deepEqual(body(), []);
    });
});
