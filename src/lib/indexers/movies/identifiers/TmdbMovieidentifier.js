import MovieIdentifier from '../MovieIdentifier';
import IdentificationError from '../../../errors/IdentificationError';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TmdbMovieIdentifier extends MovieIdentifier {
    /**
     * Identify a Movie based a file path
     *
     * @param {string} moviePath File path to the Movie
     * @param {*} guessitIdentification - Guessit identification object
     * @returns {Promise<*>} - Movie identification object
     */
    async identify(moviePath, guessitIdentification) {
        let query = { query: guessitIdentification.title };

        if (guessitIdentification.year) {
            query.primary_release_year = guessitIdentification.year;
        }

        let res = await promiseTimeout(this.oblecto.tmdb.searchMovie(query, { timeout: 5000 }));

        let identifiedMovie = res.results[0];

        if (!identifiedMovie) {
            throw new IdentificationError();
        }

        return {
            tmdbid: identifiedMovie.id,
            movieName: identifiedMovie.title,
            overview: identifiedMovie.overview,
        };
    }

}
