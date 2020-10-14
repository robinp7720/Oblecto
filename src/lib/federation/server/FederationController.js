import FederationMediaServer from './FederationMediaServer';
import FederationDataServer from './FederationDataServer';

export default class FederationController{
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.initiateFederation();
    }

    initiateFederation () {
        this.federationMediaServer = new FederationMediaServer(this.oblecto, this.oblecto.config.federation.mediaPort);
        this.federationDataServer = new FederationDataServer(this.oblecto, this.oblecto.config.federation.dataPort);
    }

    close() {
        this.federationDataServer.close();
        this.federationMediaServer.close();
    }
}

