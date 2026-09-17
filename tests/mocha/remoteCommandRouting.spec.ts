import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import DeviceRegistry from '../../src/lib/realtime/DeviceRegistry.js';
import RealtimeClient from '../../src/lib/realtime/RealtimeClient.js';
import RealtimeController from '../../src/lib/realtime/RealtimeController.js';

import type { Socket } from 'socket.io';
import type { CommandAck, DeliveredCommand, DeviceIdentity } from '../../src/lib/realtime/types.js';
import type Oblecto from '../../src/lib/oblecto/index.js';

type Delivery = { event: string; payload: DeliveredCommand };

/**
 * A socket stand-in that records deliveries and answers acks the way a real
 * receiving device would, so the whole two-hop path can be exercised without a
 * Socket.IO server.
 */
class FakeSocket extends EventEmitter {
    public id: string;
    public deliveries: Delivery[] = [];
    public emitted: { event: string; payload: unknown }[] = [];
    public disconnected = false;

    /** How the device answers a delivered command; null never answers at all. */
    public reply: CommandAck | null = { ok: true };

    constructor(id: string) {
        super();
        this.id = id;
    }

    timeout(): this {
        return this;
    }

    emitWithAck(event: string, payload: DeliveredCommand): Promise<CommandAck> {
        this.deliveries.push({
            event,
            payload
        });

        if (this.reply === null) return Promise.reject(new Error('operation has timed out'));

        return Promise.resolve(this.reply);
    }

    emit(event: string, ...args: unknown[]): boolean {
        this.emitted.push({
            event,
            payload: args[0]
        });

        return super.emit(event, ...args);
    }

    disconnect(): void {
        this.disconnected = true;
    }
}

const identity = (deviceId: string, name: string, canPlay = true): DeviceIdentity => ({
    deviceId,
    name,
    capabilities: canPlay ? ['control', 'playback'] : ['control']
});

/**
 * Builds a controller with its registry and client map populated by hand,
 * bypassing the Socket.IO server the real constructor would create.
 */
function buildController(): RealtimeController {
    const controller = Object.create(RealtimeController.prototype) as RealtimeController;

    controller.oblecto = {} as Oblecto;
    controller.clients = {};
    controller.registry = new DeviceRegistry<Socket>();

    return controller;
}

function attach(controller: RealtimeController, userId: number, device: DeviceIdentity): FakeSocket {
    const socket = new FakeSocket(`socket-${userId}-${device.deviceId}`);
    const client = new RealtimeClient(
        controller.oblecto,
        controller,
        socket as unknown as Socket,
        { id: userId },
        device
    );

    controller.clients[socket.id] = client;
    controller.registry.register(userId, device, socket as unknown as Socket);

    return socket;
}

describe('Remote command routing', () => {
    it('delivers a command to the target and relays the target\'s own ack', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');

        attach(controller, 1, phone);

        const tv = attach(controller, 1, identity('tv', 'Living room TV'));

        const result = await controller.dispatchCommand(1, phone, {
            targetDeviceId: 'tv',
            command: {
                type: 'play',
                media: {
                    kind: 'movie',
                    id: '42'
                }
            }
        });

        assert.deepEqual(result, { ok: true });
        assert.equal(tv.deliveries.length, 1);
        assert.equal(tv.deliveries[0].event, 'remote:command');
        assert.deepEqual(tv.deliveries[0].payload.command, {
            type: 'play',
            media: {
                kind: 'movie',
                id: '42'
            }
        });
        assert.deepEqual(tv.deliveries[0].payload.from, {
            deviceId: 'phone',
            name: 'Phone'
        });
    });

    it('refuses to address another user\'s device and delivers nothing', async () => {
        const controller = buildController();
        const attacker = identity('attacker', 'Attacker');

        attach(controller, 1, attacker);

        const victim = attach(controller, 2, identity('victim-tv', 'Victim TV'));

        const result = await controller.dispatchCommand(1, attacker, {
            targetDeviceId: 'victim-tv',
            command: {
                type: 'play',
                media: {
                    kind: 'movie',
                    id: '42'
                }
            }
        });

        assert.equal(result.ok, false);
        assert.equal(result.ok === false && result.code, 'unknown_device');
        assert.equal(victim.deliveries.length, 0, 'the victim device is never contacted');
    });

    it('reports an unknown device rather than hanging', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');

        attach(controller, 1, phone);

        const result = await controller.dispatchCommand(1, phone, {
            targetDeviceId: 'nothing-here',
            command: { type: 'pause' }
        });

        assert.equal(result.ok === false && result.code, 'unknown_device');
    });

    it('refuses playback commands aimed at a device that cannot play', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');

        attach(controller, 1, phone);

        const indexer = attach(controller, 1, identity('indexer', 'Indexer', false));

        const result = await controller.dispatchCommand(1, phone, {
            targetDeviceId: 'indexer',
            command: { type: 'pause' }
        });

        assert.equal(result.ok === false && result.code, 'unsupported');
        assert.equal(indexer.deliveries.length, 0);
    });

    it('reports a timeout when the target never answers', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');

        attach(controller, 1, phone);

        const tv = attach(controller, 1, identity('tv', 'Living room TV'));

        tv.reply = null;

        const result = await controller.dispatchCommand(1, phone, {
            targetDeviceId: 'tv',
            command: { type: 'pause' }
        });

        assert.equal(result.ok === false && result.code, 'timeout');
    });

    it('reports failure when the target rejects the command', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');

        attach(controller, 1, phone);

        const tv = attach(controller, 1, identity('tv', 'Living room TV'));

        tv.reply = {
            ok: false,
            code: 'failed',
            error: 'Nothing is playing'
        };

        const result = await controller.dispatchCommand(1, phone, {
            targetDeviceId: 'tv',
            command: { type: 'pause' }
        });

        assert.equal(result.ok === false && result.code, 'failed');
        assert.equal(result.ok === false && result.error, 'Nothing is playing');
    });

    it('applies a rename to the registry and passes it on to the device', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');

        attach(controller, 1, phone);

        const tv = attach(controller, 1, identity('tv', 'Chrome on Linux'));

        await controller.dispatchCommand(1, phone, {
            targetDeviceId: 'tv',
            command: {
                type: 'rename',
                name: 'Living room TV'
            }
        });

        assert.equal(controller.registry.get(1, 'tv')?.name, 'Living room TV');
        assert.deepEqual(tv.deliveries[0].payload.command, {
            type: 'rename',
            name: 'Living room TV'
        });
    });

    it('rejects a malformed command without reaching the registry', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');
        const socket = attach(controller, 1, phone);

        attach(controller, 1, identity('tv', 'Living room TV'));

        const acks: CommandAck[] = [];

        await controller.clients[socket.id].commandHandler(
            {
                targetDeviceId: 'tv',
                command: { type: 'explode' }
            },
            ack => acks.push(ack)
        );

        assert.equal(acks.length, 1);
        assert.equal(acks[0].ok === false && acks[0].code, 'invalid');
    });

    it('answers a command sent without a target id', async () => {
        const controller = buildController();
        const phone = identity('phone', 'Phone');
        const socket = attach(controller, 1, phone);
        const acks: CommandAck[] = [];

        await controller.clients[socket.id].commandHandler({ command: { type: 'pause' } }, ack => acks.push(ack));

        assert.equal(acks[0].ok === false && acks[0].code, 'invalid');
    });
});

describe('Playback state reporting', () => {
    it('records a valid report against the reporting device', () => {
        const controller = buildController();
        const socket = attach(controller, 1, identity('tv', 'Living room TV'));

        controller.clients[socket.id].stateHandler({
            status: 'playing',
            media: {
                kind: 'episode',
                id: '7',
                title: 'Blink'
            },
            position: 61.5,
            duration: 2700,
            volume: 0.8,
            muted: false,
            canSeek: true,
            canSetVolume: true,
            hasNext: true
        });

        const state = controller.registry.get(1, 'tv')?.state;

        assert.equal(state?.status, 'playing');
        assert.equal(state?.media?.title, 'Blink');
        assert.equal(state?.position, 61.5);
        assert.equal(state?.hasNext, true);
        assert.ok((state?.updatedAt ?? 0) > 0);
    });

    it('discards a malformed report and leaves the device idle', () => {
        const controller = buildController();
        const socket = attach(controller, 1, identity('tv', 'Living room TV'));

        controller.clients[socket.id].stateHandler({ status: 'sideways' });

        assert.equal(controller.registry.get(1, 'tv')?.state.status, 'idle');
    });

    it('rate limits a flood of reports from one device', () => {
        const controller = buildController();
        const socket = attach(controller, 1, identity('tv', 'Living room TV'));
        const client = controller.clients[socket.id];

        const report = (position: number) => client.stateHandler({
            status: 'playing',
            media: {
                kind: 'movie',
                id: '1'
            },
            position,
            duration: 100,
            volume: 1,
            muted: false,
            canSeek: true,
            canSetVolume: true,
            hasNext: false
        });

        for (let i = 1; i <= 40; i++) report(i);

        // Ten get through in the window; the rest are dropped, so the recorded
        // position is the tenth and not the fortieth.
        assert.equal(controller.registry.get(1, 'tv')?.state.position, 10);
    });
});
