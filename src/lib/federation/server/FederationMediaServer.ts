import FederationServer from './FederationServer.js';
import FederationMediaServerConnection from './FederationMediaServerConnection.js';

import type tls from 'tls';

export default class FederationMediaServer extends FederationServer {
    secureConnectionHandler(socket: tls.TLSSocket): void {
        super.secureConnectionHandler(socket);

        void new FederationMediaServerConnection(this.oblecto, socket);
    }
}
