import databases from '../../submodules/database';

export default class FederationEpisodeIndexer {
    constructor(oblecto) {
        this.oblecto = oblecto;

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('federationIndexEpisode', async (job) => {
            await this.indexEpisode(job);
        });
    }

    async indexEpisode(file) {
        let [fileEntity, fileInserted] = await databases.file.findOrCreate({
            where: {
                host: file.host,
                path: file.id
            },
            defaults: {
                name: '',
                directory: '',
                extension: '',
                duration: file.duration
            }
        });

        let [series, seriesInserted] = await databases.tvshow.findOrCreate({
            where: {
                tvdbid: file.fileInfo.seriesTvdbid || null,
                tmdbid: file.fileInfo.seriesTmdbid || null
            }
        });

        let [episode, episodeInserted] = await databases.episode.findOrCreate({
            where: {
                tvdbid: file.fileInfo.tvdbid || null,
                tmdbid: file.fileInfo.tmdbid || null,
                tvshowId: series.id
            },
            defaults: {
                airedEpisodeNumber: file.fileInfo.episode,
                airedSeason: file.fileInfo.season
            }
        });

        await episode.addFile(fileEntity);

        if (!episodeInserted) return;
        await this.oblecto.seriesUpdateCollector.collectEpisode(episode);
        await this.oblecto.seriesArtworkCollector.collectArtworkEpisodeBanner(episode);

        if (!seriesInserted) return;
        await this.oblecto.seriesUpdateCollector.collectSeries(series);
        await this.oblecto.seriesArtworkCollector.collectArtworkSeriesPoster(series);

    }
}
