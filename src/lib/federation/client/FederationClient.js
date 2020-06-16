import net from 'net';

export default class FederationClient{
    constructor (host, port) {
        this.socket = net.createConnection({
            host,
            port: port || 9132
        });

        this.socket.on('data', this.data);
    }

    data (buffer) {

    }
}
