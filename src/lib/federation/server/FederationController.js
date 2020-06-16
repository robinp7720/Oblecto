import net from 'net';
import FederationMediaServer from './FederationMediaServer';
import FederationDataServer from './FederationDataServer';

export default {
    federationDataServer: null,
    federationMediaServer: null,
    federationServerId: '2fde73ff-4163-444a-a8d4-c494e6669359', // TODO: Generate a randomized federation id on oblecto initation

    initiateFederation: function () {
        this.federationMediaServer = new FederationMediaServer(9132);
        this.federationDataServer = new FederationDataServer(9131);
    },

    getPublicKey(serverId) {
        // TODO: Load public keys from fs
        return 'assaxlozuegcejsmzuwgisgh';
    },

    getPrivateKey() {
        return 'assaxlozuegcejsmzuwgisgh';
    }
};

