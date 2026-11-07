import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Movie } from '../../../../models/movie.js';
import type { Dependencies } from '../../../contracts.js';

type ServiceDependencies = Dependencies<'tmdb', never>;

type TmdbImage = { file_path: string };

type TmdbImageResponse = {
    backdrops: TmdbImage[];
    posters: TmdbImage[];
};

export default class TmdbMovieArtworkRetriever {
    public oblecto: ServiceDependencies;

    constructor(oblecto: ServiceDependencies) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param movie - Movie for which to get fanart URLs for
     * @returns - Array of fanart URLs
     */
    async retrieveFanart(movie: Partial<Pick<Movie, 'tmdbid' | 'imdbid' | 'movieName'>>): Promise<string[]> {
        if (movie.tmdbid === null || movie.tmdbid === undefined) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({ id: movie.tmdbid }) as TmdbImageResponse;

        return data.backdrops.map(image => `https://image.tmdb.org/t/p/original${image.file_path}`);
    }

    /**
     *
     * @param movie - Movie for which to get poster URLs for
     * @returns - Array of poster URLs
     */
    async retrievePoster(movie: Partial<Pick<Movie, 'tmdbid' | 'imdbid' | 'movieName'>>): Promise<string[]> {
        if (movie.tmdbid === null || movie.tmdbid === undefined) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({ id: movie.tmdbid }) as TmdbImageResponse;

        return data.posters.map(image => `https://image.tmdb.org/t/p/original${image.file_path}`);
    }
}
