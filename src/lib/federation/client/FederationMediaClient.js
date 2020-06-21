import FederationClient from './FederationClient';

export default class FederationMediaClient extends FederationClient {
    constructor(host, port) {
        super(host, port);

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
            console.log('Server did not respect file id. Destroying connection');

            this.socket.destroy();
        }

        console.log('server is ready');

        this.socket.pipe(this.streamDestination);

        this.startStream();
    }

    async startStream() {
        if (!this.streamDestination) throw new Error('No destination');

        console.log('sending start signal');

        this.socket.write('START:START\n');
    }

    async setStreamOffset(offset) {
        this.socket.write(`OFFSET:${offset}\n`);
    }
}
