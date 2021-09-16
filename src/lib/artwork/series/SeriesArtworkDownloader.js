import AggregateSeriesArtworkRetriever from './AggregateSeriesArtworkRetriever';
import TmdbSeriesArtworkRetriever from './artworkRetrievers/TmdbSeriesArtworkRetriever';
import TvdbSeriesArtworkRetriever from './artworkRetrievers/TvdbSeriesArtworkRetriever';
import FanarttvSeriesArtworkRetriever from './artworkRetrievers/FanarttvSeriesArtworkRetriever';
import logger from '../../../submodules/logger';

import { Series } from '../../../models/series';
import { Episode } from '../../../models/episode';

export default class SeriesArtworkDownloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.seriesArtworkRetriever = new AggregateSeriesArtworkRetriever(this.oblecto);
        this.seriesArtworkRetriever.loadRetriever(new TmdbSeriesArtworkRetriever(this.oblecto));
        this.seriesArtworkRetriever.loadRetriever(new FanarttvSeriesArtworkRetriever(this.oblecto));
        this.seriesArtworkRetriever.loadRetriever(new TvdbSeriesArtworkRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('downloadEpisodeBanner', this.downloadEpisodeBanner);
        this.oblecto.queue.registerJob('downloadSeriesPoster', this.downloadSeriesPoster);
    }

    /**
     *
     * @param {Episode} episode - Episode for which to download a banner for
     * @returns {Promise<void>}
     */
    async downloadEpisodeBanner(episode) {
        await this.seriesArtworkRetriever.retrieveEpisodeBanner(episode);

        logger.log('DEBUG', `Banner for ${episode.episodeName} downloaded`);

        for (let size of Object.keys(this.oblecto.config.artwork.banner)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.episodeBannerPath(episode),
                to: this.oblecto.artworkUtils.episodeBannerPath(episode, size),
                width: this.oblecto.config.artwork.banner[size]
            });
        }
    }

    /**
     *
     * @param {Series} series - Series for which to download a poster for
     * @returns {Promise<void>}
     */
    async downloadSeriesPoster(series) {
        await this.seriesArtworkRetriever.retrieveSeriesPoster(series);

        logger.log('DEBUG', `Poster for ${series.seriesName} downloaded`);

        for (let size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.seriesPosterPath(series),
                to: this.oblecto.artworkUtils.seriesPosterPath(series, size),
                width: this.oblecto.config.artwork.poster[size]
            });
        }
    }

}
