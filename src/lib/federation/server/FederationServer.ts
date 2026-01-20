import tls from 'tls';
import fs from 'fs';

import type Oblecto from '../../oblecto/index.js';

export default class FederationServer {
    public oblecto: Oblecto;
    public server: tls.Server;

    constructor(oblecto: Oblecto, port: number) {
        this.oblecto = oblecto;

        const options = {
            key: fs.readFileSync(this.oblecto.config.federation.key),
            cert: fs.readFileSync('/etc/oblecto/keys/public-cert.pem'),
        };

        this.server = tls.createServer(options, () => {});

        this.server.listen(port);

        this.server.on('error', (err: Error) => this.errorHandler(err));
        this.server.on('connection', (socket: tls.TLSSocket) => this.connectionHandler(socket));
        this.server.on('secureConnection', (socket: tls.TLSSocket) => this.secureConnectionHandler(socket));
    }

    errorHandler(error: Error): void {
        void error;
    }

    connectionHandler(socket: tls.TLSSocket): void {
        void socket;
    }

    secureConnectionHandler(socket: tls.TLSSocket): void {
        void socket;
    }

    close(): void {
        this.server.close();
    }
}
