import Download from '../../downloader';
import TmdbMovieArtworkRetriever from './artworkRetrievers/TmdbMovieArtworkRetriever';
import FanarttvMovieArtworkRetriever from './artworkRetrievers/FanarttvMovieArtworkRetriever';
import AggregateMovieArtworkRetriever from './AggregateMovieArtworkRetriever';
import logger from '../../../submodules/logger';

export default class MovieArtworkDownloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.movieArtworkRetriever = new AggregateMovieArtworkRetriever(this.oblecto);
        this.movieArtworkRetriever.loadRetriever(new FanarttvMovieArtworkRetriever(this.oblecto));
        this.movieArtworkRetriever.loadRetriever(new TmdbMovieArtworkRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('downloadMoviePoster', async (job) => {
            await this.downloadMoviePoster(job);
        });

        this.oblecto.queue.addJob('downloadMovieFanart', async (job) => {
            await this.downloadMovieFanart(job);
        });
    }

    async downloadMoviePoster(movie) {
        await this.movieArtworkRetriever.retrievePoster(movie);

        logger.log('DEBUG', `Poster for ${movie.movieName} downloaded`);

        for (let size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.moviePosterPath(movie),
                to: this.oblecto.artworkUtils.moviePosterPath(movie, size),
                width: this.oblecto.config.artwork.poster[size]
            });
        }
    }

    async downloadMovieFanart(movie) {
        await this.movieArtworkRetriever.retrieveFanart(movie);

        logger.log('DEBUG', `Fanart for ${movie.movieName} downloaded`);

        for (let size of Object.keys(this.oblecto.config.artwork.fanart)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.movieFanartPath(movie),
                to: this.oblecto.artworkUtils.movieFanartPath(movie, size),
                width: this.oblecto.config.artwork.fanart[size]
            });
        }
    }

}
