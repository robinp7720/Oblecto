import { Movie } from '../../../models/movie.js';
import { fileExists } from '../../../submodules/utils.js';
import logger from '../../../submodules/logger/index.js';

import type Oblecto from '../../oblecto/index.js';

export default class MovieArtworkCollector {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param movie - Movie for which to download fanart for
     */
    async collectArtworkMovieFanart(movie: Movie): Promise<void> {
        if (await fileExists(this.oblecto.artworkUtils.movieFanartPath(movie))) return;

        this.oblecto.queue.queueJob('downloadMovieFanart', movie);
    }

    /**
     *
     * @param movie - Movie for which to download poster for
     */
    async collectArtworkMoviePoster(movie: Movie): Promise<void> {
        if (await fileExists(this.oblecto.artworkUtils.moviePosterPath(movie))) return;

        this.oblecto.queue.queueJob('downloadMoviePoster', movie);
    }

    /**
     *
     */
    async collectAllMovieFanart(): Promise<void> {
        logger.debug( 'Collecting Movie fanart to download');

        const movies = await Movie.findAll();

        for (const movie of movies) {
            await this.collectArtworkMovieFanart(movie);
        }
    }

    /**
     *
     */
    async collectAllMoviePosters(): Promise<void> {
        logger.debug( 'Collecting Movie posters to download');

        const movies = await Movie.findAll();

        for (const movie of movies) {
            await this.collectArtworkMoviePoster(movie);
        }
    }

    /**
     *
     */
    async collectAll(): Promise<void> {
        await this.collectAllMoviePosters();
        await this.collectAllMovieFanart();
    }
}
