import tls from 'tls';
import fs from 'fs';

export default class FederationServer {
    constructor(port) {
        let options = {
            key: fs.readFileSync('/etc/oblecto/keys/private-key.pem'),
            cert: fs.readFileSync('/etc/oblecto/keys/public-cert.pem'),

            ca: [fs.readFileSync('/etc/oblecto/keys/csr.pem')],
        };

        this.server = tls.createServer(options, (socket) => {

        });

        this.server.listen(port);

        this.server.on('error', this.errorHandler);
        this.server.on('connection', this.connectionHandler);
        this.server.on('secureConnection', this.secureConnectionHandler);
    }

    errorHandler(error) {
        console.log(error);
    }
    connectionHandler(socket) {
        console.log("A client has connected!");
    }
    secureConnectionHandler(socket) {
        console.log('A secure connection has been initiated');
    }
}
