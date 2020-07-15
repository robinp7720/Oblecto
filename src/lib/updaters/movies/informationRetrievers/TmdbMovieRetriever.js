export default class TmdbMovieRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveMovieInformation(movie) {
        let movieInfo = await this.oblecto.movieInfo({ id: movie.tmdbid });

        let data = {
            movieName: movieInfo.title,
            overview: movieInfo.overview,
            popularity: movieInfo.popularity,
            releaseDate: movieInfo.release_date
        };

        return data;

    }
}
