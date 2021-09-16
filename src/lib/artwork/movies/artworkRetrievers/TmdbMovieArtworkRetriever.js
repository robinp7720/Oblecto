import DebugExtendableError from '../../../errors/DebugExtendableError';

import { Movie } from '../../../../models/movie';

export default class TmdbMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Movie} movie - Movie for which to get fanart URLs for
     * @returns {Promise<string[]>} - Array of fanart URLs
     */
    async retrieveFanart(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({ id: movie.tmdbid });

        return data.backdrops.map(image => `https://image.tmdb.org/t/p/original${image['file_path']}`);
    }

    /**
     *
     * @param {Movie} movie - Movie for which to get poster URLs for
     * @returns {Promise<string[]>} - Array of poster URLs
     */
    async retrievePoster(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({ id: movie.tmdbid });

        return data.posters.map(image => `https://image.tmdb.org/t/p/original${image['file_path']}`);
    }
}
