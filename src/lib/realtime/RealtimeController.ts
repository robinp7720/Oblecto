import { Server } from 'socket.io';
import RealtimeClient from './RealtimeClient.js';

import type { Socket } from 'socket.io';
import type Oblecto from '../oblecto/index.js';

type RealtimeClientMap = Record<string, RealtimeClient>;

export default class RealtimeController {
    public oblecto: Oblecto;
    public clients: RealtimeClientMap;
    public server: Server;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
        this.clients = {};

        this.server = new Server(oblecto.oblectoAPI.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
                allowedHeaders: ['Authorization', 'Content-Type'],
                credentials: false
            },
            transports: ['websocket', 'polling']
        });

        this.server.on('connection', (socket: Socket) => {
            this.connectionHandler(socket);
        });
    }

    connectionHandler(socket: Socket): void {
        this.clients[socket.id] = new RealtimeClient(this.oblecto, socket);
        this.clients[socket.id].on('disconnect', () => {
            delete this.clients[socket.id];
        });
    }

    broadcast(event: string, payload: unknown): void {
        this.server.emit(event, payload);
    }

    async close(): Promise<void> {
        await Promise.all(Object.values(this.clients).map(client => client.disconnect()));
        await new Promise<void>((resolve, reject) => {
            void this.server.close(() => resolve()).catch(reject);
        });
    }
}
