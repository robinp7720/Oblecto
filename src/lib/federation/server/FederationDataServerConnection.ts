import FederationServerConnection from './FederationServerConnection.js';
import { File } from '../../../models/file.js';
import { Movie } from '../../../models/movie.js';
import { Episode } from '../../../models/episode.js';
import { Series } from '../../../models/series.js';

import type Oblecto from '../../oblecto/index.js';
import type tls from 'tls';

export default class FederationDataServerConnection extends FederationServerConnection {
    public fullSyncPermitted: boolean;

    constructor(oblecto: Oblecto, socket: tls.TLSSocket) {
        super(oblecto, socket);
        this.fullSyncPermitted = true;
    }

    async headerHandler(data: string): Promise<void> {
        super.headerHandler(data);

        if (!this.authenticated) return;

        const split = data.split(':');

        switch (split[0]) {
            case 'SYNC':
                this.syncHandler(split[1]);
                break;
        }
    }

    syncHandler(data: string): boolean | undefined {
        if (data === 'FULL') {
            if (!this.fullSyncPermitted) return false;
            void this.startFullSync();
            return true;
        }
        return undefined;
    }

    async startFullSync(): Promise<void> {
        await this.syncFiles();
    }

    async syncFiles(): Promise<void> {
        const results = await File.findAll({
            include: [
                Movie,
                {
                    model: Episode,
                    include: [Series]
                }
            ]
        }) as Array<File & { Episodes?: Array<Episode & { Series: Series }>; Movies?: Movie[] }>;

        for (const result of results) {
            if (this.socket.destroyed) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const file = result.toJSON() as any;

            const fileInfo: Record<string, unknown> = {};

            if (file.Episodes?.[0]) {
                fileInfo.type = 'episode';

                fileInfo.episode = file.Episodes[0].airedEpisodeNumber;
                fileInfo.season = file.Episodes[0].airedSeason;

                if (file.Episodes[0].tvdbid)
                    fileInfo.tvdbid = file.Episodes[0].tvdbid;

                if (file.Episodes[0].tmdbid)
                    fileInfo.tmdbid = file.Episodes[0].tmdbid;

                if (file.Episodes[0].Series.tvdbid)
                    fileInfo.seriesTvdbid = file.Episodes[0].Series.tvdbid;
                if (file.Episodes[0].Series.tmdbid)
                    fileInfo.seriesTmdbid = file.Episodes[0].Series.tmdbid;
            }

            if (file.Movies?.[0]) {
                fileInfo.type = 'movie';
                fileInfo.tmdbid = file.Movies[0].tmdbid;
            }

            const syncInfo = {
                id: file.id,
                duration: file.duration,
                fileInfo
            };

            this.write('FILE', Buffer.from(JSON.stringify(syncInfo)).toString('base64'));

            // TODO: Negotiate a syncing speed
            await sleep(100);
        }
    }
}

/**
 * Sleep for a certain amount of milliseconds
 * @param ms - Milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
