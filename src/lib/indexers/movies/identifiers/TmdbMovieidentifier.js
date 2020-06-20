import guessit from '../../../../submodules/guessit';
import tmdb from '../../../../submodules/tmdb';

export default class TmdbMovieIdentifier {
    constructor() {

    }

    async identify(path) {
        let identification = await guessit.identify(path);

        if (!identification.title) {
            console.log('A movie title could not be extracted from', path);
            return false;
        }

        let query = {query: identification.title};

        if (identification.year) {
            query.primary_release_year = identification.year;
        }

        let res = await tmdb.searchMovie(query);

        let identifiedMovie = res.results[0];

        if (!identifiedMovie) {
            throw new Error('Could not identify movie');
        }

        return {
            tmdbid: identifiedMovie.id,
            movieName: identifiedMovie.title,
            overview: identifiedMovie.overview,
        };
    }

}
