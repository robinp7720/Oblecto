import { Series } from '../../models/series.js';
import { Episode } from '../../models/episode.js';
import { File } from '../../models/file.js';

import type Oblecto from '../oblecto/index.js';

type FederationEpisodePayload = {
    host: string;
    id: string;
    duration?: number;
    fileInfo: {
        type: 'episode';
        episode: string | number;
        season: string | number;
        tvdbid?: number;
        tmdbid?: number;
        seriesTvdbid?: number;
        seriesTmdbid?: number;
    };
};

export default class FederationEpisodeIndexer {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('federationIndexEpisode', async (job: FederationEpisodePayload) => {
            await this.indexEpisode(job);
        });
    }

    async indexEpisode(file: FederationEpisodePayload): Promise<void> {
        const [fileEntity] = await File.findOrCreate({
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

        const seriesQuery: Record<string, unknown> = {};

        if (file.fileInfo.seriesTvdbid) seriesQuery.tvdbid = file.fileInfo.seriesTvdbid;
        if (file.fileInfo.seriesTmdbid) seriesQuery.tmdbid = file.fileInfo.seriesTmdbid;

        const [series, seriesInserted] = await Series.findOrCreate({ where: seriesQuery });

        const episodeQuery: Record<string, unknown> = { SeriesId: series.id };

        if (file.fileInfo.tvdbid) episodeQuery.tvdbid = file.fileInfo.tvdbid;
        if (file.fileInfo.tmdbid) episodeQuery.tmdbid = file.fileInfo.tmdbid;

        const [episode, episodeInserted] = await Episode.findOrCreate({
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
