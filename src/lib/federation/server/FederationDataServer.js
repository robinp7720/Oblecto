import FederationServer from './FederationServer';
import FederationDataServerConnection from './FederationDataServerConnection';

export default class FederationMediaServer extends FederationServer {
    secureConnectionHandler(socket) {
        super.secureConnectionHandler(socket);

        // eslint-disable-next-line no-unused-vars
        let connection = new FederationDataServerConnection(this.oblecto, socket);
    }
}
