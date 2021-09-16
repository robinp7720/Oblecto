import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever';
import TmdbMovieRetriever from './informationRetrievers/TmdbMovieRetriever';
import logger from '../../../submodules/logger';
import { Movie } from '../../../models/movie';

export default class MovieUpdater {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateMovieUpdateRetriever = new AggregateUpdateRetriever();

        const movieUpdateRetrievers = {
            'tmdb': TmdbMovieRetriever
        };

        for (let updater of this.oblecto.config.movies.movieUpdaters) {
            logger.log('DEBUG', `Loading ${updater} movie updater`);
            this.aggregateMovieUpdateRetriever.loadRetriever(new movieUpdateRetrievers[updater](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('updateMovie', async (job) => {
            await this.updateMovie(job);
        });
    }

    /**
     * Fetch new movie metadata for a given movie entity
     *
     * @param {Movie} movie - Movie entity to be updated
     * @returns {Promise<void>}
     */
    async updateMovie(movie) {
        let data = await this.aggregateMovieUpdateRetriever.retrieveInformation(movie);

        await movie.update(data);
    }
}
