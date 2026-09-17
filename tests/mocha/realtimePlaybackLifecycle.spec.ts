import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import DeviceRegistry from '../../src/lib/realtime/DeviceRegistry.js';
import RealtimeClient from '../../src/lib/realtime/RealtimeClient.js';
import RealtimeController from '../../src/lib/realtime/RealtimeController.js';

import type { Socket } from 'socket.io';
import type Oblecto from '../../src/lib/oblecto/index.js';

type FakeSocket = EventEmitter & { id: string; disconnect: () => void };

function fakeSocket(id: string): FakeSocket {
    const socket = new EventEmitter() as FakeSocket;

    socket.id = id;
    socket.disconnect = () => { socket.emit('disconnect'); };

    return socket;
}

describe('Realtime shutdown', () => {
    it('disconnects every device and empties the registry before closing the server', async () => {
        const controller = Object.create(RealtimeController.prototype) as RealtimeController;

        controller.oblecto = {} as Oblecto;
        controller.clients = {};
        controller.registry = new DeviceRegistry<Socket>();

        for (const [id, name] of [['tv', 'Living room TV'], ['phone', 'Phone']]) {
            const socket = fakeSocket(`socket-${id}`);
            const identity = {
                deviceId: id,
                name,
                capabilities: ['control', 'playback'] as const
            };

            const client = new RealtimeClient(
                controller.oblecto,
                controller,
                socket as unknown as Socket,
                { id: 1 },
                {
                    ...identity,
                    capabilities: [...identity.capabilities]
                }
            );

            controller.clients[socket.id] = client;
            client.on('disconnect', () => { delete controller.clients[socket.id]; });
            controller.registry.register(1, client.identity, socket as unknown as Socket);
        }

        assert.equal(controller.registry.listFor(1).length, 2);

        let closed = false;

        controller.server = {
            close: (callback: () => void) => {
                closed = true;
                callback();

                return Promise.resolve();
            }
        } as unknown as RealtimeController['server'];

        await controller.close();

        assert.equal(closed, true);
        assert.equal(Object.keys(controller.clients).length, 0, 'every client is torn down');
        assert.equal(controller.registry.listFor(1).length, 0, 'the registry is emptied');
    });

    it('removes a device from the registry when its socket drops', () => {
        const controller = Object.create(RealtimeController.prototype) as RealtimeController;

        controller.oblecto = {} as Oblecto;
        controller.clients = {};
        controller.registry = new DeviceRegistry<Socket>();

        const socket = fakeSocket('socket-tv');
        const client = new RealtimeClient(
            controller.oblecto,
            controller,
            socket as unknown as Socket,
            { id: 1 },
            {
                deviceId: 'tv',
                name: 'Living room TV',
                capabilities: ['control', 'playback']
            }
        );

        controller.clients[socket.id] = client;
        controller.registry.register(1, client.identity, socket as unknown as Socket);

        socket.emit('disconnect');

        assert.equal(controller.registry.listFor(1).length, 0);
    });
});
