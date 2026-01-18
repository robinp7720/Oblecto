import AggregateSeriesArtworkRetriever from './AggregateSeriesArtworkRetriever.js';
import TmdbSeriesArtworkRetriever from './artworkRetrievers/TmdbSeriesArtworkRetriever.js';
import TvdbSeriesArtworkRetriever from './artworkRetrievers/TvdbSeriesArtworkRetriever.js';
import FanarttvSeriesArtworkRetriever from './artworkRetrievers/FanarttvSeriesArtworkRetriever.js';
import logger from '../../../submodules/logger/index.js';

import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';

import type Oblecto from '../../oblecto/index.js';

type RescaleJob = {
    from: string;
    to: string;
    width: number;
};

export default class SeriesArtworkDownloader {
    public oblecto: Oblecto;
    public seriesArtworkRetriever: AggregateSeriesArtworkRetriever;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.seriesArtworkRetriever = new AggregateSeriesArtworkRetriever(this.oblecto);
        this.seriesArtworkRetriever.loadRetriever(new TmdbSeriesArtworkRetriever(this.oblecto));
        this.seriesArtworkRetriever.loadRetriever(new FanarttvSeriesArtworkRetriever(this.oblecto));
        this.seriesArtworkRetriever.loadRetriever(new TvdbSeriesArtworkRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('downloadEpisodeBanner', (episode: Episode) => this.downloadEpisodeBanner(episode));
        this.oblecto.queue.registerJob('downloadSeriesPoster', (series: Series) => this.downloadSeriesPoster(series));
    }

    /**
     *
     * @param episode - Episode for which to download a banner for
     */
    async downloadEpisodeBanner(episode: Episode): Promise<void> {
        await this.seriesArtworkRetriever.retrieveEpisodeBanner(episode);

        logger.debug( `Banner for ${episode.episodeName} downloaded`);

        for (const size of Object.keys(this.oblecto.config.artwork.banner)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.episodeBannerPath(episode),
                to: this.oblecto.artworkUtils.episodeBannerPath(episode, size),
                width: this.oblecto.config.artwork.banner[size]
            } as RescaleJob);
        }
    }

    /**
     *
     * @param series - Series for which to download a poster for
     */
    async downloadSeriesPoster(series: Series): Promise<void> {
        await this.seriesArtworkRetriever.retrieveSeriesPoster(series);

        logger.debug( `Poster for ${series.seriesName} downloaded`);

        for (const size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.seriesPosterPath(series),
                to: this.oblecto.artworkUtils.seriesPosterPath(series, size),
                width: this.oblecto.config.artwork.poster[size]
            } as RescaleJob);
        }
    }
}
