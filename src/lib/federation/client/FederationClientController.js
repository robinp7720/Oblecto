import FederationDataClient from './FederationDataClient';

export default {
    syncClients: [],

    addSyncMaster: function (host, port) {
        this.syncClients.push(new FederationDataClient(host, port));
    },

    requestFullSync() {
        for (let server of this.syncClients) {
            server.requestFullSync();
        }
    }
};
