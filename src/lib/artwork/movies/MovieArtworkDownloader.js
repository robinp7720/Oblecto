import Download from '../../downloader';
import ArtworkUtils from '../ArtworkUtils';
import TmdbMovieArtworkRetriever from './artworkRetrievers/TmdbMovieArtworkRetriever';
import AggregateMovieArtworkRetriever from './AggregateMovieArtworkRetriever';

export default class MovieArtworkDownloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.movieArtworkRetriever = new AggregateMovieArtworkRetriever();
        this.movieArtworkRetriever.loadRetriever(new TmdbMovieArtworkRetriever());

        this.artworkUtils = new ArtworkUtils(this.oblecto);
    }

    async downloadMoviePoster(movie) {
        let url = await this.movieArtworkRetriever.retrievePoster(movie);

        await Download.download(
            url,
            this.artworkUtils.moviePosterPath(movie)
        );

        for (let size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.artworkUtils.moviePosterPath(movie),
                to: this.artworkUtils.moviePosterPath(movie, size),
                width: this.oblecto.config.artwork.poster[size]
            });
        }
    }

    async downloadMovieFanart(movie) {
        let url = await this.movieArtworkRetriever.retrieveFanart(movie);

        await Download.download(
            url,
            this.artworkUtils.movieFanartPath(movie)
        );

        for (let size of Object.keys(this.oblecto.config.artwork.fanart)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.artworkUtils.movieFanartPath(movie),
                to: this.artworkUtils.movieFanartPath(movie, size),
                width: this.oblecto.config.artwork.fanart[size]
            });
        }
    }

}
