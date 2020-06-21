import tmdb from '../../../../submodules/tmdb';

export default class TmdbMovieRetriever {
    async retrieveMovieInformation(movie) {
        let movieInfo = await tmdb.movieInfo({ id: movie.tmdbid });

        let data = {
            movieName: movieInfo.title,
            overview: movieInfo.overview,
            popularity: movieInfo.popularity,
            releaseDate: movieInfo.release_date
        };

        return data;

    }
}
