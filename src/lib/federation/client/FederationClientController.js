import FederationDataClient from './FederationDataClient';

export default class FederationClientController{
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.syncClients = [];
    }

    async addSyncMaster (host, port) {
        let client = new FederationDataClient(host, port);
        await client.connect();

        this.syncClients.push(client);
    }

    requestFullSync() {
        for (let server of this.syncClients) {
            server.requestFullSync();
        }
    }
}
