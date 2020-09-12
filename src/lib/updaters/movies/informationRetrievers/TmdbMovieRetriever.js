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
            imdbid: movieInfo.imdb_id,

            movieName: movieInfo.title,
            originalName: movieInfo.original_title,
            tagline: movieInfo.tagline,

            originalLanguage: movieInfo.original_language,

            budget: movieInfo.budget,
            revenue: movieInfo.revenue,

            runtime: movieInfo.runtime,

            overview: movieInfo.overview,
            popularity: movieInfo.popularity,
            releaseDate: movieInfo.release_date
        };

        return data;

    }
}
