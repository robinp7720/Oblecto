import FederationServerConnection from './FederationServerConnection';
import { File } from '../../../models/file';
import { Movie } from '../../../models/movie';
import { Episode } from '../../../models/episode';
import { Series } from '../../../models/series';

export default class FederationDataServerConnection extends FederationServerConnection {
    constructor(oblecto, socket) {
        super(oblecto, socket);
        this.fullSyncPermitted = true;
    }

    async headerHandler(data) {
        super.headerHandler(data);

        if (!this.authenticated) return;

        let split = data.split(':');

        switch (split[0]) {
            case 'SYNC':
                this.syncHandler(split[1]);
                break;
        }
    }

    syncHandler(data) {
        if (data === 'FULL') {
            if (!this.fullSyncPermitted) return false;
            return this.startFullSync();
        }
    }

    async startFullSync() {
        await this.syncFiles();
    }

    async syncFiles() {
        let results = await File.findAll({
            include: [
                Movie,
                {
                    model: Episode,
                    include: [Series]
                }
            ]
        });

        for (let result of results) {
            if (this.socket.destroyed) return;

            let file = result.toJSON();

            let fileInfo = {};

            if (file.Episodes[0]) {
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

            if (file.Movies[0]) {
                fileInfo.type = 'movie';
                fileInfo.tmdbid = file.Movies[0].tmdbid;
            }

            let syncInfo = {
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
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
