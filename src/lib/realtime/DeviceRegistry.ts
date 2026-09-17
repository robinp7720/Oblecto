import { EventEmitter } from 'events';

import { IDLE_PLAYBACK_STATE } from './types.js';

import type { DeviceCapability, DeviceIdentity, DeviceSnapshot, PlaybackState } from './types.js';

/**
 * A device belonging to one user, together with whatever socket currently
 * speaks for it.
 *
 * `socket` is deliberately untyped here: the registry never touches the socket
 * itself, it only hands it back to `RealtimeController` to emit into. Keeping
 * it opaque is what makes this class testable without a Socket.IO server.
 */
export type DeviceSession<TSocket = unknown> = {
    userId: number;
    deviceId: string;
    name: string;
    capabilities: DeviceCapability[];
    connectedAt: number;
    state: PlaybackState;
    socket: TSocket;
};

/**
 * In-memory directory of every connected device, partitioned by user.
 *
 * The partitioning is the security boundary: a lookup takes the caller's own
 * user id, so a device belonging to somebody else cannot be addressed at all
 * rather than being addressable-but-rejected.
 */
export default class DeviceRegistry<TSocket = unknown> extends EventEmitter {
    private devices: Map<number, Map<string, DeviceSession<TSocket>>>;

    constructor() {
        super();

        this.devices = new Map();
    }

    /**
     * Registers a socket as a device, or rebinds an existing device to a new
     * socket.
     *
     * A reconnect carrying a known deviceId keeps the name and last reported
     * state, which is what stops the picker flickering on a page reload and
     * what makes a selected target survive one.
     * @param userId - Owner of the device.
     * @param identity - Verified handshake identity.
     * @param socket - Transport to deliver commands into.
     * @returns The registered session, and the socket it displaced if any.
     */
    register(userId: number, identity: DeviceIdentity, socket: TSocket): {
        session: DeviceSession<TSocket>;
        displaced: TSocket | null;
    } {
        let owned = this.devices.get(userId);

        if (!owned) {
            owned = new Map();
            this.devices.set(userId, owned);
        }

        const existing = owned.get(identity.deviceId);
        const displaced = existing && existing.socket !== socket ? existing.socket : null;

        const session: DeviceSession<TSocket> = {
            userId,
            deviceId: identity.deviceId,
            // A reconnecting device re-asserts its name from its own storage,
            // so the handshake wins over what we remembered.
            name: identity.name,
            capabilities: identity.capabilities,
            connectedAt: existing?.connectedAt ?? Date.now(),
            state: existing?.state ?? { ...IDLE_PLAYBACK_STATE },
            socket
        };

        owned.set(identity.deviceId, session);
        this.emitChanged(userId);

        return {
            session,
            displaced
        };
    }

    /**
     * Removes a device, but only if the given socket is still the one bound to
     * it. A socket displaced by a newer tab disconnects afterwards, and must
     * not take its successor's registration down with it.
     * @param userId - Owner of the device.
     * @param deviceId - Device to remove.
     * @param socket - Socket claiming the removal.
     * @returns Whether anything was removed.
     */
    unregister(userId: number, deviceId: string, socket: TSocket): boolean {
        const owned = this.devices.get(userId);
        const session = owned?.get(deviceId);

        if (!owned || session?.socket !== socket) return false;

        owned.delete(deviceId);
        if (owned.size === 0) this.devices.delete(userId);

        this.emitChanged(userId);

        return true;
    }

    /**
     * Looks a device up within one user's own devices.
     * @param userId - Owner of the device.
     * @param deviceId - Device to find.
     * @returns The session, or undefined when this user has no such device.
     */
    get(userId: number, deviceId: string): DeviceSession<TSocket> | undefined {
        return this.devices.get(userId)?.get(deviceId);
    }

    /**
     * @param userId - Owner whose devices to list.
     * @returns Every connected device belonging to that user.
     */
    listFor(userId: number): DeviceSession<TSocket>[] {
        return [...(this.devices.get(userId)?.values() ?? [])];
    }

    /** @returns Every connected device across all users, for diagnostics only. */
    all(): DeviceSession<TSocket>[] {
        return [...this.devices.values()].flatMap(owned => [...owned.values()]);
    }

    /**
     * Records a state report from a device.
     * @param userId - Owner of the device.
     * @param deviceId - Device reporting.
     * @param socket - Socket the report arrived on; a displaced socket is ignored.
     * @param state - Validated state, whose `updatedAt` is stamped here.
     * @returns Whether the report was accepted.
     */
    updateState(userId: number, deviceId: string, socket: TSocket, state: PlaybackState): boolean {
        const session = this.get(userId, deviceId);

        if (session?.socket !== socket) return false;

        session.state = {
            ...state,
            updatedAt: Date.now()
        };

        this.emit('state', userId, session);

        return true;
    }

    /**
     * @param userId - Owner of the device.
     * @param deviceId - Device to rename.
     * @param name - New name, already normalised.
     * @returns Whether the device existed.
     */
    rename(userId: number, deviceId: string, name: string): boolean {
        const session = this.get(userId, deviceId);

        if (!session) return false;

        session.name = name;
        this.emitChanged(userId);

        return true;
    }

    /**
     * Builds the device list as one particular device sees it.
     * @param userId - Owner whose devices to describe.
     * @param selfDeviceId - The viewing device, flagged so it can exclude itself.
     * @returns Snapshots ordered by connection time, oldest first.
     */
    snapshotFor(userId: number, selfDeviceId: string | null): DeviceSnapshot[] {
        return this.listFor(userId)
            .map(session => ({
                deviceId: session.deviceId,
                name: session.name,
                capabilities: [...session.capabilities],
                isSelf: session.deviceId === selfDeviceId,
                connectedAt: session.connectedAt,
                state: session.state
            }))
            .sort((a, b) => a.connectedAt - b.connectedAt);
    }

    /** Drops every device. Used on shutdown. */
    clear(): void {
        this.devices.clear();
    }

    private emitChanged(userId: number): void {
        this.emit('changed', userId);
    }
}
