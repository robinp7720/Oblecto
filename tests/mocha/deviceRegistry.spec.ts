import assert from 'node:assert/strict';

import DeviceRegistry from '../../src/lib/realtime/DeviceRegistry.js';
import { IDLE_PLAYBACK_STATE } from '../../src/lib/realtime/types.js';

import type { DeviceIdentity, PlaybackState } from '../../src/lib/realtime/types.js';

type FakeSocket = { id: string };

const identity = (deviceId: string, name: string, canPlay = true): DeviceIdentity => ({
    deviceId,
    name,
    capabilities: canPlay ? ['control', 'playback'] : ['control']
});

const playingState = (position: number): PlaybackState => ({
    ...IDLE_PLAYBACK_STATE,
    status: 'playing',
    media: {
        kind: 'movie',
        id: '42',
        title: 'Arrival'
    },
    position,
    duration: 7200,
    canSeek: true
});

describe('DeviceRegistry', () => {
    it('registers a device under its owner with the name it declared', () => {
        const registry = new DeviceRegistry<FakeSocket>();
        const socket = { id: 's1' };

        const { session, displaced } = registry.register(1, identity('dev-a', 'Firefox on Linux'), socket);

        assert.equal(session.name, 'Firefox on Linux');
        assert.notEqual(session.name, 'default');
        assert.equal(displaced, null);
        assert.deepEqual(registry.listFor(1).map(entry => entry.deviceId), ['dev-a']);
    });

    it('keeps one user\'s devices out of another user\'s listing', () => {
        const registry = new DeviceRegistry<FakeSocket>();

        registry.register(1, identity('dev-a', 'Phone'), { id: 's1' });
        registry.register(2, identity('dev-b', 'Laptop'), { id: 's2' });

        assert.deepEqual(registry.listFor(1).map(entry => entry.deviceId), ['dev-a']);
        assert.deepEqual(registry.listFor(2).map(entry => entry.deviceId), ['dev-b']);
        assert.equal(registry.get(1, 'dev-b'), undefined);
        assert.equal(registry.get(2, 'dev-a'), undefined);
    });

    it('preserves name and state when a device reconnects on a new socket', () => {
        const registry = new DeviceRegistry<FakeSocket>();
        const first = { id: 's1' };
        const second = { id: 's2' };

        registry.register(1, identity('dev-a', 'Living room'), first);
        registry.updateState(1, 'dev-a', first, playingState(120));

        const { displaced } = registry.register(1, identity('dev-a', 'Living room'), second);

        assert.equal(displaced, first, 'the superseded socket is handed back so it can be closed');
        assert.equal(registry.listFor(1).length, 1, 'a reload does not create a second device');
        assert.equal(registry.get(1, 'dev-a')?.state.position, 120);
        assert.equal(registry.get(1, 'dev-a')?.socket, second);
    });

    it('ignores an unregister from a socket that has already been superseded', () => {
        const registry = new DeviceRegistry<FakeSocket>();
        const first = { id: 's1' };
        const second = { id: 's2' };

        registry.register(1, identity('dev-a', 'Living room'), first);
        registry.register(1, identity('dev-a', 'Living room'), second);

        // The displaced socket's disconnect arrives after its replacement has
        // registered; it must not take the live one down with it.
        assert.equal(registry.unregister(1, 'dev-a', first), false);
        assert.equal(registry.listFor(1).length, 1);

        assert.equal(registry.unregister(1, 'dev-a', second), true);
        assert.equal(registry.listFor(1).length, 0);
    });

    it('rejects a state report from a socket that no longer owns the device', () => {
        const registry = new DeviceRegistry<FakeSocket>();
        const first = { id: 's1' };
        const second = { id: 's2' };

        registry.register(1, identity('dev-a', 'Living room'), first);
        registry.register(1, identity('dev-a', 'Living room'), second);

        assert.equal(registry.updateState(1, 'dev-a', first, playingState(999)), false);
        assert.equal(registry.get(1, 'dev-a')?.state.position, 0);
    });

    it('stamps updatedAt server-side rather than trusting the device clock', () => {
        const registry = new DeviceRegistry<FakeSocket>();
        const socket = { id: 's1' };
        const before = Date.now();

        registry.register(1, identity('dev-a', 'Living room'), socket);
        registry.updateState(1, 'dev-a', socket, {
            ...playingState(10),
            updatedAt: 1
        });

        const stamped = registry.get(1, 'dev-a')?.state.updatedAt ?? 0;

        assert.ok(stamped >= before, 'the reported updatedAt is overwritten');
    });

    it('renames a device and reports it in the snapshot', () => {
        const registry = new DeviceRegistry<FakeSocket>();

        registry.register(1, identity('dev-a', 'Chrome on Linux'), { id: 's1' });

        assert.equal(registry.rename(1, 'dev-a', 'Living room TV'), true);
        assert.equal(registry.snapshotFor(1, null)[0].name, 'Living room TV');
        assert.equal(registry.rename(1, 'missing', 'Nope'), false);
    });

    it('flags the viewing device as itself so a controller can exclude it', () => {
        const registry = new DeviceRegistry<FakeSocket>();

        registry.register(1, identity('dev-a', 'Phone'), { id: 's1' });
        registry.register(1, identity('dev-b', 'Laptop'), { id: 's2' });

        const snapshot = registry.snapshotFor(1, 'dev-a');

        assert.equal(snapshot.find(entry => entry.deviceId === 'dev-a')?.isSelf, true);
        assert.equal(snapshot.find(entry => entry.deviceId === 'dev-b')?.isSelf, false);
    });

    it('records the capabilities a device declared', () => {
        const registry = new DeviceRegistry<FakeSocket>();

        registry.register(1, identity('dev-a', 'Indexer', false), { id: 's1' });

        assert.deepEqual(registry.snapshotFor(1, null)[0].capabilities, ['control']);
    });

    it('emits a change for the affected user only', () => {
        const registry = new DeviceRegistry<FakeSocket>();
        const changed: number[] = [];

        registry.on('changed', (userId: number) => changed.push(userId));

        registry.register(1, identity('dev-a', 'Phone'), { id: 's1' });
        registry.register(2, identity('dev-b', 'Laptop'), { id: 's2' });

        assert.deepEqual(changed, [1, 2]);
    });
});
