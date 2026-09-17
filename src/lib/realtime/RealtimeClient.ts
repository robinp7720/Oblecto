import { EventEmitter } from 'events';

import logger from '../../submodules/logger/index.js';
import { COMMAND_TIMEOUT_MS, MAX_STATE_REPORTS_PER_SECOND, parseCommandEnvelope, parsePlaybackState } from './types.js';

import type { Socket } from 'socket.io';
import type { CommandAck, DeliveredCommand, DeviceIdentity, RemoteCommand } from './types.js';
import type Oblecto from '../oblecto/index.js';
import type RealtimeController from './RealtimeController.js';

export type AuthUser = {
    id: number;
} & Record<string, unknown>;

/**
 * One authenticated socket.
 *
 * Authentication happens in the controller's handshake middleware, so a client
 * only ever exists in an authenticated state — there is no window in which
 * `user` is null and every consumer has to remember to guard it.
 */
export default class RealtimeClient extends EventEmitter {
    public oblecto: Oblecto;
    public socket: Socket;
    public user: AuthUser;
    public identity: DeviceIdentity;

    private controller: RealtimeController;
    private stateWindowStart: number;
    private stateReportsInWindow: number;

    /**
     * @param oblecto - Oblecto server instance.
     * @param controller - Realtime controller owning the device registry.
     * @param socket - Authenticated socket.io socket.
     * @param user - Verified JWT payload.
     * @param identity - Device identity from the handshake.
     */
    constructor(
        oblecto: Oblecto,
        controller: RealtimeController,
        socket: Socket,
        user: AuthUser,
        identity: DeviceIdentity
    ) {
        super();

        this.oblecto = oblecto;
        this.controller = controller;
        this.socket = socket;
        this.user = user;
        this.identity = identity;

        this.stateWindowStart = 0;
        this.stateReportsInWindow = 0;

        this.socket.on('playback:state', (data: unknown) => this.stateHandler(data));
        this.socket.on('remote:command', (data: unknown, ack?: (result: CommandAck) => void) => {
            void this.commandHandler(data, ack);
        });
        this.socket.on('disconnect', () => this.disconnectHandler());
    }

    get deviceId(): string {
        return this.identity.deviceId;
    }

    get name(): string {
        return this.identity.name;
    }

    /** @returns Whether this device is a usable remote playback target. */
    canPlay(): boolean {
        return this.identity.capabilities.includes('playback');
    }

    /**
     * Handles a state report from this device.
     * @param data - Untrusted `playback:state` payload.
     */
    stateHandler(data: unknown): void {
        if (!this.withinStateRateLimit()) return;

        const state = parsePlaybackState(data);

        if (!state) {
            logger.warn(`Discarding malformed playback state from device ${this.deviceId}`);

            return;
        }

        this.controller.registry.updateState(this.user.id, this.deviceId, this.socket, state);
    }

    /**
     * Handles a command this device wants to send to another of the user's
     * devices.
     * @param data - Untrusted `remote:command` payload.
     * @param ack - Socket.IO acknowledgement callback, when the caller supplied one.
     */
    async commandHandler(data: unknown, ack?: (result: CommandAck) => void): Promise<void> {
        const envelope = parseCommandEnvelope(data);

        if (!envelope) {
            ack?.({
                ok: false,
                code: 'invalid',
                error: 'Malformed command'
            });

            return;
        }

        const result = await this.controller.dispatchCommand(this.user.id, this.identity, envelope);

        ack?.(result);
    }

    /**
     * Delivers a command to this device and waits for it to accept.
     *
     * The ack is the target's own, relayed back to whoever sent the command,
     * so a controller learns that playback actually started rather than only
     * that the server forwarded a message.
     * @param command - Command to run.
     * @param from - Device that issued it.
     * @param from.deviceId - Issuing device's id.
     * @param from.name - Issuing device's name.
     * @returns The target's acknowledgement.
     */
    async deliver(command: RemoteCommand, from: { deviceId: string; name: string }): Promise<CommandAck> {
        const payload: DeliveredCommand = {
            from,
            command
        };

        try {
            const result = await this.socket
                .timeout(COMMAND_TIMEOUT_MS)
                .emitWithAck('remote:command', payload) as CommandAck | undefined;

            if (result && typeof result === 'object' && result.ok === true) return { ok: true };

            return {
                ok: false,
                code: 'failed',
                error: typeof result?.error === 'string' ? result.error : 'The device rejected the command'
            };
        } catch {
            return {
                ok: false,
                code: 'timeout',
                error: 'The device did not respond'
            };
        }
    }

    /**
     * Applies a rename to this device's own identity, so a subsequent
     * reconnect is not required for the new name to be visible.
     * @param name - Normalised new name.
     */
    applyName(name: string): void {
        this.identity = {
            ...this.identity,
            name
        };
    }

    /** Sends this device the current view of its owner's devices. */
    sendDeviceList(): void {
        this.socket.emit('devices', this.controller.registry.snapshotFor(this.user.id, this.deviceId));
    }

    async disconnect(): Promise<void> {
        this.socket.disconnect();
        this.disconnectHandler();

        return Promise.resolve();
    }

    disconnectHandler(): void {
        this.controller.registry.unregister(this.user.id, this.deviceId, this.socket);
        this.emit('disconnect');
    }

    /**
     * @returns Whether this report falls within the per-second allowance.
     */
    private withinStateRateLimit(): boolean {
        const now = Date.now();

        if (now - this.stateWindowStart >= 1000) {
            this.stateWindowStart = now;
            this.stateReportsInWindow = 0;
        }

        this.stateReportsInWindow += 1;

        if (this.stateReportsInWindow > MAX_STATE_REPORTS_PER_SECOND) {
            if (this.stateReportsInWindow === MAX_STATE_REPORTS_PER_SECOND + 1)
                logger.warn(`Rate limiting playback state reports from device ${this.deviceId}`);

            return false;
        }

        return true;
    }
}
