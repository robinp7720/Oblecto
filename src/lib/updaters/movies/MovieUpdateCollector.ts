import { Movie } from '../../../models/movie.js';

import type Oblecto from '../../oblecto/index.js';

export default class MovieUpdateCollector {
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
     * @param movie - Which movie entity to update;
     */
    async collectMovie(movie: Movie): Promise<void> {
        this.oblecto.queue.queueJob('updateMovie', movie);
    }

    /**
     *
     */
    async collectAllMovies(): Promise<void> {
        const movies = await Movie.findAll();

        for (const movie of movies) {
            await this.collectMovie(movie);
        }
    }
}
