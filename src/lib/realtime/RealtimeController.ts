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
            log: false,
            agent: false,
            origins: '*:*',
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

    close(): void {
        for (const client of Object.keys(this.clients)) {
            this.clients[client].disconnect();
        }

        this.server.close();
    }
}
