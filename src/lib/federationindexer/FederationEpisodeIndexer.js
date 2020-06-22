import databases from '../../submodules/database';

export default class FederationEpisodeIndexer {
    constructor(oblecto) {
        this.oblecto = oblecto;
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

        if (!episodeInserted) return episode;

        await this.oblecto.seriesUpdateCollector.collectSeries(series);
        await this.oblecto.seriesUpdateCollector.collectEpisode(episode);

        await this.oblecto.seriesArtworkCollector.collectArtworkSeriesPoster(series);
        await this.oblecto.seriesArtworkCollector.collectArtworkEpisodeBanner(episode);

        await episode.addFile(fileEntity);
    }
}
