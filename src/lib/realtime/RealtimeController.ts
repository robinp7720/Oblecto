import { Server } from 'socket.io';
import { verifyAccessToken } from '../auth/tokens.js';

import logger from '../../submodules/logger/index.js';
import RealtimeClient from './RealtimeClient.js';
import DeviceRegistry from './DeviceRegistry.js';
import { parseDeviceIdentity } from './types.js';
import { progressEvents, type ProgressChange } from '../playback/progress.js';

import type { Socket } from 'socket.io';
import type { AuthUser } from './RealtimeClient.js';
import type { CommandAck, CommandEnvelope, DeviceIdentity, RemoteCommand } from './types.js';
import type Oblecto from '../oblecto/index.js';

/** What the handshake middleware leaves on `socket.data` for the connection handler. */
type SocketData = {
    user: AuthUser;
    identity: DeviceIdentity;
};

/** Commands only a device that declared the `playback` capability can serve. */
const PLAYBACK_COMMANDS: ReadonlySet<RemoteCommand['type']> = new Set([
    'play',
    'pause',
    'resume',
    'stop',
    'seek',
    'setVolume',
    'setMuted',
    'next'
]);

export default class RealtimeController {
    public oblecto: Oblecto;
    public clients: Record<string, RealtimeClient>;
    public registry: DeviceRegistry<Socket>;
    public server: Server;
    private unsubscribeProgress?: () => void;

    publishProgress(userId: number, change: ProgressChange): void {
        for (const client of Object.values(this.clients)) {
            if (client.user.id === userId) client.socket.emit('media:progress', change);
        }
    }

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
        this.clients = {};
        this.registry = new DeviceRegistry<Socket>();

        this.server = new Server(oblecto.oblectoAPI.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
                allowedHeaders: ['Authorization', 'Content-Type'],
                credentials: false
            },
            transports: ['websocket', 'polling']
        });

        // Authenticating in the handshake rather than in a post-connect event
        // means a socket is never half-connected: anything that reaches
        // `connection` already has a verified user and a declared device.
        this.server.use((socket, next) => {
            this.authenticationMiddleware(socket, next);
        });

        this.server.on('connection', (socket: Socket) => {
            this.connectionHandler(socket);
        });

        // Any change to a user's devices, including a state report, is pushed
        // to that user's own sockets. Nobody subscribes; there is no
        // subscription state to fall out of sync on reconnect.
        this.registry.on('changed', (userId: number) => this.publishDevices(userId));
        this.registry.on('state', (userId: number) => this.publishDevices(userId));
        const onProgress = this.publishProgress.bind(this);
        progressEvents.on('saved', onProgress);
        this.unsubscribeProgress = () => { progressEvents.off('saved', onProgress); };
    }

    /**
     * Verifies the JWT and device identity carried in the socket handshake.
     * @param socket - Connecting socket.
     * @param next - Socket.IO middleware continuation.
     */
    authenticationMiddleware(socket: Socket, next: (err?: Error) => void): void {
        const auth = socket.handshake.auth as { token?: unknown; device?: unknown };

        if (typeof auth?.token !== 'string') {
            next(new Error('A token is required to connect'));

            return;
        }

        verifyAccessToken(auth.token, this.oblecto.config.authentication).then(claims => {
            if (!claims) {
                logger.warn('An unauthorized user attempted connection to realtime server');
                next(new Error('Authentication failed'));

                return;
            }

            this.admit(socket, claims as AuthUser, auth.device, next);
        }).catch((error: unknown) => next(error instanceof Error ? error : new Error(String(error))));
    }

    private admit(socket: Socket, user: AuthUser, device: unknown, next: (err?: Error) => void): void {
        const identity = parseDeviceIdentity(device);

        if (!identity) {
            next(new Error('A device identity is required to connect'));

            return;
        }

        const data = socket.data as SocketData;

        data.user = user;
        data.identity = identity;

        next();
    }

    connectionHandler(socket: Socket): void {
        const { user, identity } = socket.data as SocketData;

        const client = new RealtimeClient(this.oblecto, this, socket, user, identity);

        this.clients[socket.id] = client;
        client.on('disconnect', () => {
            delete this.clients[socket.id];
        });

        const { displaced } = this.registry.register(user.id, identity, socket);

        // A second tab claiming the same device id takes it over; the old one
        // is dropped so commands only ever have one destination.
        if (displaced) {
            logger.info(`Device ${identity.deviceId} reconnected, dropping its previous session`);
            displaced.disconnect();
        }

        client.sendDeviceList();
    }

    /**
     * Routes a command from one of a user's devices to another.
     *
     * This is the single authorization chokepoint: the target is resolved
     * inside the caller's own device map, so another user's device is not
     * merely rejected, it is unaddressable.
     * @param userId - Caller's user id.
     * @param from - Device issuing the command.
     * @param envelope - Validated target and command.
     * @returns The target's acknowledgement, or the reason it could not be delivered.
     */
    async dispatchCommand(userId: number, from: DeviceIdentity, envelope: CommandEnvelope): Promise<CommandAck> {
        const target = this.registry.get(userId, envelope.targetDeviceId);

        if (!target) {
            return {
                ok: false,
                code: 'unknown_device',
                error: 'That device is not connected'
            };
        }

        if (envelope.command.type === 'rename') {
            this.registry.rename(userId, envelope.targetDeviceId, envelope.command.name);
            this.clients[target.socket.id]?.applyName(envelope.command.name);
        }

        if (PLAYBACK_COMMANDS.has(envelope.command.type) && !target.capabilities.includes('playback')) {
            return {
                ok: false,
                code: 'unsupported',
                error: 'That device cannot play media'
            };
        }

        // A registry entry whose socket has already been torn down: the index
        // signature promises a client, the map does not.
        const client = this.clients[target.socket.id] as RealtimeClient | undefined;

        if (client === undefined) {
            return {
                ok: false,
                code: 'unknown_device',
                error: 'That device is not connected'
            };
        }

        return client.deliver(envelope.command, {
            deviceId: from.deviceId,
            name: from.name
        });
    }

    /**
     * Pushes the device list to every socket belonging to one user.
     * @param userId - User whose devices changed.
     */
    publishDevices(userId: number): void {
        for (const client of Object.values(this.clients)) {
            if (client.user.id === userId) client.sendDeviceList();
        }
    }

    broadcast(event: string, payload: unknown): void {
        this.server.emit(event, payload);
    }

    async close(): Promise<void> {
        this.unsubscribeProgress?.();
        await Promise.all(Object.values(this.clients).map(client => client.disconnect()));
        this.registry.clear();
        await new Promise<void>((resolve, reject) => {
            void this.server.close(() => resolve()).catch(reject);
        });
    }
}
