import FederationClient from './FederationClient';
import databases from '../../../submodules/database';
import tvdb from '../../../submodules/tvdb';
import async from 'async';

export default class FederationDataClient extends FederationClient {
    /**
     *
     * @param {Oblecto} oblecto
     * @param {string} server
     */
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
                    let episode = await this.episodeHandler(file.fileInfo);
                    episode.addFile(fileEntity);
                } catch (e) {
                    console.log(e);
                }
            }

            if (file.fileInfo.type === 'movie') {
                console.log('recived a movie');
                try {
                    let movie = await this.movieHandler(file.fileInfo);
                    movie.addFile(fileEntity);

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
            this.fileHandler(split[1]);
            break;
        }
    }

    requestFullSync() {
        this.write('SYNC', 'FULL');
    }

    async fileHandler(data) {
        let input = Buffer.from(data, 'base64').toString();

        try {
            let file = JSON.parse(input);

            this.indexQueue.push(file);
        } catch (e) {

        }

    }

    async episodeHandler(data) {
        let [series, seriesInserted] = await databases.tvshow.findOrCreate({
            where: {
                tvdbid: data.seriesTvdbid || null,
                tmdbid: data.seriesTmdbid || null
            }
        });

        let [episode, episodeInserted] = await databases.episode.findOrCreate({
            where: {
                tvdbid: data.tvdbid || null,
                tmdbid: data.tmdbid || null,
                tvshowId: series.id
            },
            defaults: {
                airedEpisodeNumber: data.episode,
                airedSeason: data.season
            }
        });

        if (!episodeInserted) return episode;

        await this.oblecto.seriesUpdateCollector.collectSeries(series);
        await this.oblecto.seriesUpdateCollector.collectEpisode(episode);

        await this.oblecto.seriesArtworkCollector.collectArtworkSeriesPoster(series);
        await this.oblecto.seriesArtworkCollector.collectArtworkEpisodeBanner(episode);

        return episode;
    }

    async movieHandler(data) {
        let [movie, movieInserted] = await databases.movie.findOrCreate({
            where: {
                tmdbid: data.tmdbid
            }
        });

        await this.oblecto.movieUpdateCollector.collectMovie(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMovieFanart(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMoviePoster(movie);

        return movie;
    }
}
