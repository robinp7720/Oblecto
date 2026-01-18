import FederationMediaServer from './FederationMediaServer.js';
import FederationDataServer from './FederationDataServer.js';

import type Oblecto from '../../oblecto/index.js';

export default class FederationController {
    public oblecto: Oblecto;
    public federationMediaServer!: FederationMediaServer;
    public federationDataServer!: FederationDataServer;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.initiateFederation();
    }

    initiateFederation(): void {
        this.federationMediaServer = new FederationMediaServer(this.oblecto, this.oblecto.config.federation.mediaPort);
        this.federationDataServer = new FederationDataServer(this.oblecto, this.oblecto.config.federation.dataPort);
    }

    close(): void {
        this.federationDataServer.close();
        this.federationMediaServer.close();
    }
}
