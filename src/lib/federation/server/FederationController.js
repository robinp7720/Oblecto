import FederationMediaServer from './FederationMediaServer';
import FederationDataServer from './FederationDataServer';

export default class FederationController{
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.initiateFederation();
    }

    initiateFederation () {
        this.federationMediaServer = new FederationMediaServer(this.oblecto, 9132);
        this.federationDataServer = new FederationDataServer(this.oblecto, 9131);
    }
}

