import {Series} from '../../models/series';
import {Episode} from '../../models/episode';
import {File} from '../../models/file';

export default class FederationEpisodeIndexer {
    constructor(oblecto) {
        this.oblecto = oblecto;

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('federationIndexEpisode', async (job) => {
            await this.indexEpisode(job);
        });
    }

    async indexEpisode(file) {
        let [fileEntity, fileInserted] = await File.findOrCreate({
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

        let [series, seriesInserted] = await Series.findOrCreate({
            where: {
                tvdbid: file.fileInfo.seriesTvdbid || null,
                tmdbid: file.fileInfo.seriesTmdbid || null
            }
        });

        let [episode, episodeInserted] = await Episode.findOrCreate({
            where: {
                tvdbid: file.fileInfo.tvdbid || null,
                tmdbid: file.fileInfo.tmdbid || null,
                SeriesId: series.id
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
