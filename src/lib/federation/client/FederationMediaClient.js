import FederationClient from './FederationClient';

export default class FederationMediaClient extends FederationClient {
    constructor(host, port) {
        super(host, port);

        this.fileId = null;
        this.streamDestination = null;
    }

    headerHandler(data, _this) {
        super.headerHandler(data, _this);

        let split = data.split(':');

        switch (split[0]) {
        case 'START':
            _this.startStreamHandler(split[1], _this);
            break;
        }
    }

    setStreamFile(fileId) {
        this.fileId = fileId;

        this.socket.write(`FILEID:${fileId}\n`);
    }

    setStreamDestination(dest) {
        this.streamDestination = dest;

        dest.on('close', () => {
            this.socket.destroy();
        });
    }

    startStream() {
        if (!this.streamDestination) throw new Error('No destination');

        this.socket.write('START:START\n');
    }

    setStreamOffset(offset) {
        this.socket.write(`OFFSET:${offset}\n`);
    }

    startStreamHandler(fileId, _this) {
        if (fileId !== this.fileId) {
            console.log('Server did not respect file id. Destroying connection');

            _this.socket.destroy();
        }

        if (!this.streamDestination) return _this.socket.destroy();

        this.socket.removeAllListeners('data');
        this.socket.pipe(this.streamDestination);

    }
}
