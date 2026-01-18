import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Movie } from '../../../../models/movie.js';
import type Oblecto from '../../../oblecto/index.js';

type TmdbImage = { file_path: string };

type TmdbImageResponse = {
    backdrops: TmdbImage[];
    posters: TmdbImage[];
};

export default class TmdbMovieArtworkRetriever {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param movie - Movie for which to get fanart URLs for
     * @returns - Array of fanart URLs
     */
    async retrieveFanart(movie: Movie): Promise<string[]> {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({ id: movie.tmdbid }) as TmdbImageResponse;

        return data.backdrops.map(image => `https://image.tmdb.org/t/p/original${image.file_path}`);
    }

    /**
     *
     * @param movie - Movie for which to get poster URLs for
     * @returns - Array of poster URLs
     */
    async retrievePoster(movie: Movie): Promise<string[]> {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({ id: movie.tmdbid }) as TmdbImageResponse;

        return data.posters.map(image => `https://image.tmdb.org/t/p/original${image.file_path}`);
    }
}
