import { Server } from 'socket.io';
import RealtimeClient from './RealtimeClient';

/**
 * @typedef {import('../oblecto').default} Oblecto
 */

export default class RealtimeController {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
        this.clients = {};

        this.server = new Server(oblecto.oblectoAPI.server.server, {
            log: false,
            agent: false,
            origins: '*:*',
            transports: ['websocket', 'polling']
        });

        this.server.on('connection', socket => {
            this.connectionHandler(socket);
        });
    }

    connectionHandler(socket) {
        this.clients[socket.id] = new RealtimeClient(this.oblecto, socket);
        this.clients[socket.id].on('disconnect', () => {
            delete this.clients[socket.id];
        });
    }

    close() {
        for (let client of Object.keys(this.clients)) {
            this.clients[client].disconnect();
        }

        this.server.close();
    }
}
