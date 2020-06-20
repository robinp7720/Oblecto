import FederationServer from './FederationServer';
import fs from 'fs';
import FederationMediaServerConnection from './FederationMediaServerConnection';

export default class FederationMediaServer extends FederationServer {
    secureConnectionHandler(socket) {
        super.secureConnectionHandler(socket);

        let connection = new FederationMediaServerConnection(socket);
    }
}
