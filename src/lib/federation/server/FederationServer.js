import net from 'net';

export default class FederationServer {
    constructor(port) {
        this.server = net.createServer();
        this.server.listen(port);

        this.server.on('error', this.errorHandler);
        this.server.on('connection', this.connectionHandler);
    }

    errorHandler(err) {}
    connectionHandler(socket) {}
}
