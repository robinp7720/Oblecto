import FederationServer from './FederationServer';
import fs from 'fs';
import FederationMediaServerConnection from './FederationMediaServerConnection';

export default class FederationMediaServer extends FederationServer {
    connectionHandler(socket) {
        super.connectionHandler(socket);

        let connection = new FederationMediaServerConnection(socket);
    }
}
