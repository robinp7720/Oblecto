import AggregateSeriesArtworkRetriever from './AggregateSeriesArtworkRetriever';
import Download from '../../downloader';
import ArtworkUtils from '../ArtworkUtils';
import TmdbSeriesArtworkRetriever from './artworkRetrievers/TmdbSeriesArtworkRetriever';
import TvdbSeriesArtworkRetriever from './artworkRetrievers/TvdbSeriesArtworkRetriever';

export default class SeriesArtworkDownloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.seriesArtworkRetriever = new AggregateSeriesArtworkRetriever();
        this.seriesArtworkRetriever.loadRetriever(new TvdbSeriesArtworkRetriever());
        this.seriesArtworkRetriever.loadRetriever(new TmdbSeriesArtworkRetriever());

        this.artworkUtils = new ArtworkUtils(this.oblecto);
    }

    async downloadEpisodeBanner(episode) {
        let url = await this.seriesArtworkRetriever.retrieveEpisodeBanner(episode);

        await Download.download(
            url,
            this.artworkUtils.episodeBannerPath(episode)
        );

        for (let size of Object.keys(this.oblecto.config.artwork.banner)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.artworkUtils.episodeBannerPath(episode),
                to: this.artworkUtils.episodeBannerPath(episode, size),
                width: this.oblecto.config.artwork.banner[size]
            });
        }
    }

    async downloadSeriesPoster(series) {
        let url = await this.seriesArtworkRetriever.retrieveSeriesPoster(series);

        await Download.download(
            url,
            this.artworkUtils.seriesPosterPath(series)
        );

        for (let size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.artworkUtils.seriesPosterPath(series),
                to: this.artworkUtils.seriesPosterPath(series, size),
                width: this.oblecto.config.artwork.poster[size]
            });
        }
    }

}
