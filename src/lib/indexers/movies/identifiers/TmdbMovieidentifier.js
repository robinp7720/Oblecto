import guessit from '../../../../submodules/guessit';
import IdentificationError from '../../../errors/IdentificationError';

export default class TmdbMovieIdentifier {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async identify(path) {
        let identification = await guessit.identify(path);

        if (!identification.title) {
            throw new IdentificationError('Title extraction was unsuccessful');
        }

        let query = {query: identification.title};

        if (identification.year) {
            query.primary_release_year = identification.year;
        }

        let res = await this.oblecto.tmdb.searchMovie(query);

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
