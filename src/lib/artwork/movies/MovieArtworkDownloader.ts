import TmdbMovieArtworkRetriever from './artworkRetrievers/TmdbMovieArtworkRetriever.js';
import FanarttvMovieArtworkRetriever from './artworkRetrievers/FanarttvMovieArtworkRetriever.js';
import AggregateMovieArtworkRetriever from './AggregateMovieArtworkRetriever.js';
import logger from '../../../submodules/logger/index.js';

import type Oblecto from '../../oblecto/index.js';
import type { Movie } from '../../../models/movie.js';

type RescaleJob = {
    from: string;
    to: string;
    width: number;
};

export default class MovieArtworkDownloader {
    public oblecto: Oblecto;
    public movieArtworkRetriever: AggregateMovieArtworkRetriever;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.movieArtworkRetriever = new AggregateMovieArtworkRetriever(this.oblecto);
        this.movieArtworkRetriever.loadRetriever(new FanarttvMovieArtworkRetriever(this.oblecto));
        this.movieArtworkRetriever.loadRetriever(new TmdbMovieArtworkRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('downloadMoviePoster', async (job: Movie) => {
            await this.downloadMoviePoster(job);
        });

        this.oblecto.queue.registerJob('downloadMovieFanart', async (job: Movie) => {
            await this.downloadMovieFanart(job);
        });
    }

    async downloadMoviePoster(movie: Movie): Promise<void> {
        await this.movieArtworkRetriever.retrievePoster(movie);

        logger.debug( `Poster for ${movie.movieName} downloaded`);

        for (const size of Object.keys(this.oblecto.config.artwork.poster)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.moviePosterPath(movie),
                to: this.oblecto.artworkUtils.moviePosterPath(movie, size),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                width: (this.oblecto.config.artwork.poster as any)[size]
            } as RescaleJob);
        }
    }

    async downloadMovieFanart(movie: Movie): Promise<void> {
        await this.movieArtworkRetriever.retrieveFanart(movie);

        logger.debug( `Fanart for ${movie.movieName} downloaded`);

        for (const size of Object.keys(this.oblecto.config.artwork.fanart)) {
            this.oblecto.queue.pushJob('rescaleImage', {
                from: this.oblecto.artworkUtils.movieFanartPath(movie),
                to: this.oblecto.artworkUtils.movieFanartPath(movie, size),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                width: (this.oblecto.config.artwork.fanart as any)[size]
            } as RescaleJob);
        }
    }
}
