import { Movie } from '../../../models/movie.js';

import type { Dependencies } from '../../contracts.js';

type ServiceDependencies = Dependencies<'queue', never>;

export default class MovieUpdateCollector {
    public oblecto: ServiceDependencies;

    /**
     *
     * @param oblecto - Required services and configuration
     */
    constructor(oblecto: ServiceDependencies) {
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
