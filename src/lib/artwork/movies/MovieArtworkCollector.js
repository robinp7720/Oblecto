import { Movie } from '../../../models/movie';
import { fileExists } from '../../../submodules/utils';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 */

export default class MovieArtworkCollector {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Movie} movie - Movie for which to download fanart for
     * @returns {Promise<void>}
     */
    async collectArtworkMovieFanart(movie) {
        if (!await fileExists(this.oblecto.artworkUtils.movieFanartPath(movie))) return;

        this.oblecto.queue.queueJob('downloadMovieFanart', movie);
    }

    /**
     *
     * @param {Movie} movie - Movie for which to download poster for
     * @returns {Promise<void>}
     */
    async collectArtworkMoviePoster(movie) {
        if (!await fileExists(this.oblecto.artworkUtils.moviePosterPath(movie))) return;

        this.oblecto.queue.queueJob('downloadMoviePoster', movie);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllMovieFanart() {
        let movies = await Movie.findAll();

        for (let movie of movies) {
            await this.collectArtworkMovieFanart(movie);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllMoviePosters() {
        let movies = await Movie.findAll();

        for (let movie of movies) {
            await this.collectArtworkMoviePoster(movie);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAll() {
        await this.collectAllMoviePosters();
        await this.collectAllMovieFanart();
    }
}
