import { Series } from '../../models/series';
import { Episode } from '../../models/episode';
import { File } from '../../models/file';

import Oblecto from '../oblecto';

export default class FederationEpisodeIndexer {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('federationIndexEpisode', async (job) => {
            await this.indexEpisode(job);
        });
    }

    async indexEpisode(file) {
        let [fileEntity] = await File.findOrCreate({
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

        let seriesQuery = {};

        if (file.fileInfo.seriesTvdbid) seriesQuery.tvdbid = file.fileInfo.seriesTvdbid;
        if (file.fileInfo.seriesTmdbid) seriesQuery.tmdbid = file.fileInfo.seriesTmdbid;

        let [series, seriesInserted] = await Series.findOrCreate({ where: seriesQuery });

        let episodeQuery = { SeriesId: series.id };

        if (file.fileInfo.tvdbid) episodeQuery.tvdbid = file.fileInfo.tvdbid;
        if (file.fileInfo.tmdbid) episodeQuery.tmdbid = file.fileInfo.tmdbid;

        let [episode, episodeInserted] = await Episode.findOrCreate({
            where: episodeQuery,
            defaults: {
                airedEpisodeNumber: file.fileInfo.episode,
                airedSeason: file.fileInfo.season
            }
        });

        if (!episodeInserted) return;
        await episode.addFile(fileEntity);
        await this.oblecto.seriesUpdateCollector.collectEpisode(episode);
        await this.oblecto.seriesArtworkCollector.collectArtworkEpisodeBanner(episode);

        if (!seriesInserted) return;
        await this.oblecto.seriesUpdateCollector.collectSeries(series);
        await this.oblecto.seriesArtworkCollector.collectArtworkSeriesPoster(series);

    }
}
