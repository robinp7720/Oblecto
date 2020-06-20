import socketio from 'socket.io';
import RealtimeClient from './RealtimeClient';

export default class RealtimeController {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
        this.clients = {};

        this.server = socketio.listen(oblecto.oblectoAPI.server.server, {
            log: false,
            agent: false,
            origins: '*:*',
            transports: ['websocket', 'polling']
        });

        this.server.on('connection', socket => this.clients[socket.id] = new RealtimeClient(this.oblecto, socket));
    }
}
