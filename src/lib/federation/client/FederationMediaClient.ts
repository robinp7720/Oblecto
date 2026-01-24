import FederationClient from './FederationClient.js';

import type Oblecto from '../../oblecto/index.js';

type StreamDestination = NodeJS.WritableStream & {
    on: (event: 'close', cb: () => void) => void;
};

export default class FederationMediaClient extends FederationClient {
    public fileId: string | null;
    public streamDestination: StreamDestination | null;

    constructor(oblecto: Oblecto, server: string) {
        super(oblecto, server);

        this.port = oblecto.config.federation.servers[server].mediaPort;

        this.fileId = null;
        this.streamDestination = null;
    }

    headerHandler(data: string): void {
        super.headerHandler(data);

        const split = data.split(':');

        switch (split[0]) {
            case 'READY':
                void this.readyHandler(split[1]);
                break;
        }

    }

    startStreamFile(fileId: string): void {
        this.fileId = fileId;

        this.socket.write(`FILEID:${fileId}\n`);
    }

    setStreamDestination(dest: StreamDestination): void {
        this.streamDestination = dest;

        dest.on('close', () => {
            this.socket.destroy();
        });
    }

    readyHandler(data: string): void {
        if (data !== this.fileId) {
            // The server didn't respect the file id
            // This really shouldn't happen so we destroy the client

            this.socket.destroy();
        }

        if (!this.streamDestination) return;

        this.socket.pipe(this.streamDestination);

        this.startStream();
    }

    startStream(): void {
        if (!this.streamDestination) throw new Error('No destination');

        this.socket.write('START:START\n');
    }

    setStreamOffset(offset: number): void {
        this.socket.write(`OFFSET:${offset}\n`);
    }

    closeConnection(): void {
        this.socket.destroy();
    }
}
