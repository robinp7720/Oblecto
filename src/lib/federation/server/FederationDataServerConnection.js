import FederationServerConnection from './FederationServerConnection';
import databases from '../../../submodules/database';

export default class FederationDataServerConnection extends FederationServerConnection {
    constructor(oblecto, socket) {
        super(oblecto, socket);
        this.fullSyncPermitted = true;
    }

    async headerHandler(data) {
        super.headerHandler(data);

        let split = data.split(':');

        switch (split[0]) {
        case 'SYNC':
            this.syncHandler(split[1]);
            break;
        case 'OFFSET':
            break;
        case 'START':
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
        console.log('Starting full sync with client');
        await this.syncFiles();
    }

    async syncFiles() {
        let results = await databases.file.findAll({
            include: [databases.movie,
                {
                    model: databases.episode,
                    include: [databases.tvshow]
                }]
        });

        for (let result of results) {
            let file = result.toJSON();

            let fileInfo = {};

            if (file.episodes[0]) {
                fileInfo.type = 'episode';

                fileInfo.episode = file.episodes[0].airedEpisodeNumber;
                fileInfo.season = file.episodes[0].airedSeason;

                if (file.episodes[0].tvdbid)
                    fileInfo.tvdbid = file.episodes[0].tvdbid;

                if (file.episodes[0].tmdbid)
                    fileInfo.tmdbid = file.episodes[0].tmdbid;

                if (file.episodes[0].tvshow.tvdbid)
                    fileInfo.seriesTvdbid = file.episodes[0].tvshow.tvdbid;
                if (file.episodes[0].tvshow.tmdbid)
                    fileInfo.seriesTmdbid = file.episodes[0].tvshow.tmdbid;
            }

            if (file.movies[0]) {
                fileInfo.type = 'movie';
                fileInfo.tmdbid = file.movies[0].tmdbid;
            }

            let syncInfo = {
                id: file.id,
                duration: file.duration,
                fileInfo
            };

            this.write('FILE', Buffer.from(JSON.stringify(syncInfo)).toString('base64'));
        }

    }
}
