import databases from '../../../submodules/database';
import {Movie} from '../../../models/movie';

export default class MovieUpdateCollector {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Movie} movie - Which movie entity to update;
     * @returns {Promise<void>}
     */
    async collectMovie(movie) {
        this.oblecto.queue.queueJob('updateMovie', movie);
    }


    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllMovies() {
        let movies = await Movie.findAll();

        for (let movie of movies) {
            this.collectMovie(movie);
        }
    }

}
