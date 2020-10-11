import tls from 'tls';
import fs from 'fs';

export default class FederationServer {
    constructor(oblecto, port) {
        this.oblecto = oblecto;

        let options = {
            key: fs.readFileSync(this.oblecto.config.federation.key),
            cert: fs.readFileSync('/etc/oblecto/keys/public-cert.pem'),
        };

        this.server = tls.createServer(options, (socket) => {

        });

        this.server.listen(port);

        this.server.on('error', (err) => this.errorHandler(err));
        this.server.on('connection', (socket) => this.connectionHandler(socket));
        this.server.on('secureConnection', (socket) => this.secureConnectionHandler(socket));
    }

    errorHandler(error) {
        console.log(error);
    }
    connectionHandler(socket) {
        console.log('A client has connected!');
    }
    secureConnectionHandler(socket) {
        console.log('A secure connection has been initiated');
    }
}
