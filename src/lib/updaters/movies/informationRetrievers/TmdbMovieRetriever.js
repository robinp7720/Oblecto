export default class TmdbMovieRetriever {

    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(movie) {
        let movieInfo = await this.oblecto.tmdb.movieInfo({ id: movie.tmdbid });

        let data = {
            movieName: movieInfo.title,
            overview: movieInfo.overview,
            popularity: movieInfo.popularity,
            releaseDate: movieInfo.release_date
        };

        return data;

    }
}
