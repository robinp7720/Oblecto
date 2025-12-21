import promiseTimeout from '../../../../submodules/promiseTimeout';

import { Movie } from '../../../../models/movie';

/**
 * @typedef {import('../../..//oblecto').default} Oblecto
 */

export default class TmdbMovieRetriever {

    /**
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Retrieve movie metadata for a movie entity
     * @param {Movie} movie - Movie entity to fetch metadata for
     * @returns {Promise<{originalName: string, overview: *, revenue: *, releaseDate: string, imdbid: string, genres: string, popularity: *, tagline: *, runtime: *, originalLanguage: string, movieName: *, budget: *}>} - Movie metadata
     */
    async retrieveInformation(movie) {
        let movieInfo = await this.oblecto.tmdb.movieInfo({ id: movie.tmdbid });

        let data = {
            imdbid: movieInfo.imdb_id,

            movieName: movieInfo.title,
            originalName: movieInfo.original_title,
            tagline: movieInfo.tagline,
            genres: JSON.stringify(movieInfo.genres.map(i => i.name)),

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
