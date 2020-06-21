import FederationClient from './FederationClient';
import databases from '../../../submodules/database';
import tvdb from '../../../submodules/tvdb';
import async from 'async';

export default class FederationDataClient extends FederationClient {
    constructor(oblecto, server) {
        super(oblecto, server);

        this.port = oblecto.config.federation.servers[server].dataPort;

        this.indexQueue = async.queue(async (file, callback) => {
            let [fileEntity, fileInserted] = await databases.file.findOrCreate({
                where: {
                    host: this.host,
                    path: file.id
                },
                defaults: {
                    name: '',
                    directory: '',
                    extension: '',
                    duration: file.duration
                }
            });

            if (file.fileInfo.type === 'episode') {
                try {
                    let episode = await this.episodeHandler(file.fileInfo, this);
                    episode.addFile(fileEntity);
                } catch (e) {
                    console.log(e);
                }
            }

            callback();
        });
    }

    headerHandler(data) {
        super.headerHandler(data);

        let split = data.split(':');

        switch (split[0]) {
        case 'FILE':
            _this.fileHandler(split[1]);
            break;
        }
    }

    requestFullSync() {
        this.write('SYNC', 'FULL');
    }

    async fileHandler(data) {
        let input = Buffer.from(data, 'base64').toString();
        console.log(input);
        let file = JSON.parse(input);

        _this.indexQueue.push(file);

    }

    async episodeHandler(data) {
        let [episode, episodeInserted] = await databases.episode.findOrCreate({
            where: {
                tvdbid: data.tvdbid || null,
                tmdbid: data.tmdbid || null
            },
            defaults: {
                airedEpisodeNumber: data.episode,
                airedSeason: data.season
            }
        });

        if (!episodeInserted) return episode;

        let [series, seriesInserted] = await databases.tvshow.findOrCreate({
            where: {
                tvdbid: data.seriesTvdbid || null,
                tmdbid: data.seriesTmdbid || null
            }
        });


        series.addEpisode(episode);

        return episode;
    }
}
