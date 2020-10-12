import FederationClient from './FederationClient';

export default class FederationMediaClient extends FederationClient {
    constructor(oblecto, server) {
        super(oblecto, server);

        this.port = oblecto.config.federation.servers[server].mediaPort;

        this.fileId = null;
        this.streamDestination = null;
    }

    headerHandler(data) {
        super.headerHandler(data);

        let split = data.split(':');

        switch (split[0]) {
            case 'READY':
                this.readyHandler(split[1]);
                break;
        }

    }

    async startStreamFile(fileId) {
        this.fileId = fileId;

        this.socket.write(`FILEID:${fileId}\n`);
    }

    async setStreamDestination(dest) {
        this.streamDestination = dest;

        dest.on('close', () => {
            this.socket.destroy();
        });
    }

    async readyHandler(data) {
        if (data !== this.fileId) {
            // The server didn't respect the file id
            // This really shouldn't happen so we destroy the client

            this.socket.destroy();
        }

        this.socket.pipe(this.streamDestination);

        this.startStream();
    }

    async startStream() {
        if (!this.streamDestination) throw new Error('No destination');

        this.socket.write('START:START\n');
    }

    async setStreamOffset(offset) {
        this.socket.write(`OFFSET:${offset}\n`);
    }

    async closeConnection() {
        this.socket.destroy();
        delete this;
    }
}
