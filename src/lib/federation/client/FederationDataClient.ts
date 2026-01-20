import FederationClient from './FederationClient.js';

import type Oblecto from '../../oblecto/index.js';

type SyncFilePayload = {
    id: number | string;
    duration?: number;
    fileInfo: {
        type: 'episode' | 'movie';
        episode?: number | string;
        season?: number | string;
        tvdbid?: number;
        tmdbid?: number;
        seriesTvdbid?: number;
        seriesTmdbid?: number;
    };
    host?: string;
};

export default class FederationDataClient extends FederationClient {
    /**
     *
     * @param oblecto - Oblecto server instance
     * @param server - Federation server name
     */
    constructor(oblecto: Oblecto, server: string) {
        super(oblecto, server);

        this.port = oblecto.config.federation.servers[server].dataPort;
    }

    headerHandler(data: string): void {
        super.headerHandler(data);

        const split = data.split(':');

        switch (split[0]) {
            case 'FILE':
                void this.fileHandler(split[1]);
                break;
        }
    }

    requestFullSync(): void {
        this.write('SYNC', 'FULL');
    }

    async fileHandler(data: string): Promise<void> {
        const input = Buffer.from(data, 'base64').toString();

        const file = JSON.parse(input) as SyncFilePayload;

        file.host = this.serverName;

        switch (file.fileInfo.type) {
            case 'episode':
                this.oblecto.queue.queueJob('federationIndexEpisode', file);
                break;
            case 'movie':
                this.oblecto.queue.queueJob('federationIndexMovie', file);
                break;
        }
    }
}
