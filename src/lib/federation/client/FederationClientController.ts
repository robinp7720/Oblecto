import FederationDataClient from './FederationDataClient.js';

import type Oblecto from '../../oblecto/index.js';

export default class FederationClientController {
    public oblecto: Oblecto;
    public syncServers: FederationDataClient[];

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.syncServers = [];
    }

    async addAllSyncMasters(): Promise<void> {
        for (const server in this.oblecto.config.federation.servers) {
            await this.addSyncMaster(server);
        }
    }

    async addSyncMaster(server: string): Promise<void> {
        const client = new FederationDataClient(this.oblecto, server);

        await client.connect();
        await client.requestFullSync();

        this.syncServers.push(client);
    }

    requestFullSync(): void {
        for (const server of this.syncServers) {
            server.requestFullSync();
        }
    }

    close(): void {
        for (const server of this.syncServers) {
            server.close();
        }
    }
}
