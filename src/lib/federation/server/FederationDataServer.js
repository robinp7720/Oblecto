import FederationServer from './FederationServer';
import FederationDataServerConnection from './FederationDataServerConnection';

export default class FederationMediaServer extends FederationServer {
    secureConnectionHandler(socket) {
        super.secureConnectionHandler(socket);

        let connection = new FederationDataServerConnection(this.oblecto, socket);
    }
}
