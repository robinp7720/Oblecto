import FederationDataClient from './FederationDataClient';

export default class FederationClientController{
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.syncClients = [];
    }

    async addSyncMaster (server) {
        let client = new FederationDataClient(this.oblecto, server);
        await client.connect();
        await client.requestFullSync();

        this.syncClients.push(client);
    }

    requestFullSync() {
        for (let server of this.syncClients) {
            server.requestFullSync();
        }
    }
}
