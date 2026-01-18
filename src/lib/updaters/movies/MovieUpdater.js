import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever';
import TmdbMovieRetriever from './informationRetrievers/TmdbMovieRetriever';
import logger from '../../../submodules/logger';
import { Movie } from '../../../models/movie';
import { MovieSet } from '../../../models/movieSet';

export default class MovieUpdater {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateMovieUpdateRetriever = new AggregateUpdateRetriever();

        const movieUpdateRetrievers = { 'tmdb': TmdbMovieRetriever };

        this.availableUpdaters = Object.keys(movieUpdateRetrievers);

        for (let updater of this.oblecto.config.movies.movieUpdaters) {
            logger.debug( `Loading ${updater} movie updater`);
            this.aggregateMovieUpdateRetriever.loadRetriever(new movieUpdateRetrievers[updater](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('updateMovie', async (job) => {
            await this.updateMovie(job);
        });
    }

    /**
     * Fetch new movie metadata for a given movie entity
     * @param {Movie} movie - Movie entity to be updated
     * @returns {Promise<void>}
     */
    async updateMovie(movie) {
        let data = await this.aggregateMovieUpdateRetriever.retrieveInformation(movie);

        if (data._set) {
            const setInfo = data._set;
            delete data._set;

            try {
                let [movieSet] = await MovieSet.findOrCreate({
                    where: { tmdbid: setInfo.id },
                    defaults: {
                        setName: setInfo.name,
                    }
                });

                // Update name if it changed
                if (movieSet.setName !== setInfo.name) {
                    await movieSet.update({ setName: setInfo.name });
                }

                await movieSet.addMovie(movie);
                logger.debug(`Added movie ${movie.id} to set ${movieSet.setName}`);
            } catch (e) {
                logger.error(`Failed to update movie set for movie ${movie.id}`, e);
            }
        }

        await movie.update(data);
    }
}
