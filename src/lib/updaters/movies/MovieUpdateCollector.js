import databases from '../../../submodules/database';

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
     * @param movie - Which movie entity to update;
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
        let allMovies = databases.movie.findAll();

        allMovies.each((movie) => {
            this.collectMovie(movie);
        });
    }

}
