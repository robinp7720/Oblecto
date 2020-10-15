import AggregateSeriesArtworkRetriever from './AggregateSeriesArtworkRetriever';
import Download from '../../downloader';
import TmdbSeriesArtworkRetriever from './artworkRetrievers/TmdbSeriesArtworkRetriever';
import TvdbSeriesArtworkRetriever from './artworkRetrievers/TvdbSeriesArtworkRetriever';
import FanarttvSeriesArtworkRetriever from './artworkRetrievers/FanarttvSeriesArtworkRetriever';

export default class SeriesArtworkDownloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.seriesArtworkRetriever = new AggregateSeriesArtworkRetriever();
        this.seriesArtworkRetriever.loadRetriever(new TvdbSeriesArtworkRetriever(this.oblecto));
        this.seriesArtworkRetriever.loadRetriever(new TmdbSeriesArtworkRetriever(this.oblecto));
        this.seriesArtworkRetriever.loadRetriever(new FanarttvSeriesArtworkRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('downloadEpisodeBanner', (episode) => this.downloadEpisodeBanner(episode));
        this.oblecto.queue.addJob('downloadSeriesPoster', (series) => this.downloadSeriesPoster(series));
    }

    async downloadEpisodeBanner(episode) {
        let url = await this.seriesArtworkRetriever.retrieveEpisodeBanner(episode);

        await Download.download(
            url,
            this.oblecto.artworkUtils.episodeBannerPath(episode)
        );

        for (let size of Object.keys(this.oblecto.config.artwork.banner)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.episodeBannerPath(episode),
                to: this.oblecto.artworkUtils.episodeBannerPath(episode, size),
                width: this.oblecto.config.artwork.banner[size]
            });
        }
    }

    async downloadSeriesPoster(series) {
        let url = await this.seriesArtworkRetriever.retrieveSeriesPoster(series);

        await Download.download(
            url,
            this.oblecto.artworkUtils.seriesPosterPath(series)
        );

        for (let size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.seriesPosterPath(series),
                to: this.oblecto.artworkUtils.seriesPosterPath(series, size),
                width: this.oblecto.config.artwork.poster[size]
            });
        }
    }

}
