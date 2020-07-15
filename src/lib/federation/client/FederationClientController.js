import FederationDataClient from './FederationDataClient';

export default class FederationClientController{
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.syncServers = [];

        for (let server in this.oblecto.config.federation.servers) {
            this.addSyncMaster(server);
        }
    }

    async addSyncMaster (server) {
        let client = new FederationDataClient(this.oblecto, server);
        await client.connect();
        await client.requestFullSync();

        this.syncServers.push(client);
    }

    requestFullSync() {
        for (let server of this.syncClients) {
            server.requestFullSync();
        }
    }
}
