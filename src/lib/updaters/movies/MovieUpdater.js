import AggregateMovieUpdateRetriever from './AggregateMovieUpdateRetriever';
import TmdbMovieRetriever from './informationRetrievers/TmdbMovieRetriever';


export default class MovieUpdater {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateMovieUpdateRetriever = new AggregateMovieUpdateRetriever();
        this.aggregateMovieUpdateRetriever.loadRetriever(new TmdbMovieRetriever());


        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('updateMovie', async (job) => {
            await this.updateMovie(job);
        });
    }

    async updateMovie(movie) {
        let data = await this.aggregateMovieUpdateRetriever.retrieveMovieInformation(movie);
        await movie.update(data);
    }
}
