import guessit from '../../../../submodules/guessit';
import tmdb from '../../../../submodules/tmdb';

export default class TmdbMovieIdentifier {
    constructor() {

    }

    async getGenres() {
        this.genres = (await tmdb.genreMovieList()).genres;
    }

    async identify(path) {
        if(!this.genres) {
            await this.getGenres();
        }

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

        identifiedMovie.genres = identifiedMovie.genre_ids.map((id) => {
            for (let i in this.genres) {
                if (this.genres[i].id == id) {
                    return this.genres[i].name;
                }
            }
        });

        return {
            tmdbId: identifiedMovie.id,
            title: identifiedMovie.title,
            genre: identifiedMovie.genres,
            overview: identifiedMovie.overview,
            releaseDate: identifiedMovie.release_date,
            tmdb: identifiedMovie
        };
    }

}
