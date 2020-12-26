import MovieIdentifier from '../MovieIdentifier';
import guessit from '../../../../submodules/guessit';
import IdentificationError from '../../../errors/IdentificationError';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TmdbMovieIdentifier extends MovieIdentifier{
    async identify(path) {
        let identification = await guessit.identify(path);

        if (!identification.title) {
            throw new IdentificationError('Title extraction was unsuccessful');
        }

        let query = {query: identification.title};

        if (identification.year) {
            query.primary_release_year = identification.year;
        }

        let res = await promiseTimeout(this.oblecto.tmdb.searchMovie(query, {timeout: 5000}));

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
