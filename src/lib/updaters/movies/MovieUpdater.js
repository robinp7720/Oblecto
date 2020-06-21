import AggregateMovieUpdateRetriever from './AggregateMovieUpdateRetriever';
import TmdbMovieRetriever from './informationRetrievers/TmdbMovieRetriever';


export default class MovieUpdater {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateMovieUpdateRetriever = new AggregateMovieUpdateRetriever();
        this.aggregateMovieUpdateRetriever.loadRetriever(new TmdbMovieRetriever());
    }

    async updateMovie(movie) {
        let data = await this.aggregateMovieUpdateRetriever.retrieveMovieInformation(movie);
        await movie.update(data);
    }
}
