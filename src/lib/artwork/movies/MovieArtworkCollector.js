import {promises as fs} from 'fs';
import {Movie} from '../../../models/movie';

export default class MovieArtworkCollector {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param movie - Movie for which to download fanart for
     * @returns {Promise<void>}
     */
    async collectArtworkMovieFanart(movie) {
        let stat;

        try {
            stat = await fs.stat(this.oblecto.artworkUtils.movieFanartPath(movie));
        } catch (e) {}

        if (stat) return;

        this.oblecto.queue.queueJob('downloadMovieFanart', movie);
    }

    /**
     *
     * @param movie - Movie for which to download poster for
     * @returns {Promise<void>}
     */
    async collectArtworkMoviePoster(movie) {
        let stat;

        try {
            stat = await fs.stat(this.oblecto.artworkUtils.moviePosterPath(movie));
        } catch (e) {}

        if (stat) return;

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
