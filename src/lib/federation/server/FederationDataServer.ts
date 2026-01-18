import FederationServer from './FederationServer.js';
import FederationDataServerConnection from './FederationDataServerConnection.js';

import type tls from 'tls';

export default class FederationDataServer extends FederationServer {
    secureConnectionHandler(socket: tls.TLSSocket): void {
        super.secureConnectionHandler(socket);

        void new FederationDataServerConnection(this.oblecto, socket);
    }
}
