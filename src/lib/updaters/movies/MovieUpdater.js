import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever';
import TmdbMovieRetriever from './informationRetrievers/TmdbMovieRetriever';

export default class MovieUpdater {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateMovieUpdateRetriever = new AggregateUpdateRetriever();
        this.aggregateMovieUpdateRetriever.loadRetriever(new TmdbMovieRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('updateMovie', async (job) => {
            await this.updateMovie(job);
        });
    }

    /**
     *
     * @param {Movie} movie
     * @returns {Promise<void>}
     */
    async updateMovie(movie) {
        let data = await this.aggregateMovieUpdateRetriever.retrieveInformation(movie);
        await movie.update(data);
    }
}
