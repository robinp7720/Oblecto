import type { Movie } from '../../../../models/movie.js';
import type Oblecto from '../../../oblecto/index.js';

type MovieWithTmdb = Movie & {
    tmdbid: number | null;
};

type MovieSetInfo = {
    id: number;
    name: string;
};

export default class TmdbMovieRetriever {
    public oblecto: Oblecto;

    /**
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Retrieve movie metadata for a movie entity
     * @param movie - Movie entity to fetch metadata for
     * @returns - Movie metadata
     */
    async retrieveInformation(movie: MovieWithTmdb): Promise<Record<string, unknown>> {
        const movieInfo = await this.oblecto.tmdb.movieInfo({ id: movie.tmdbid });

        const data: Record<string, unknown> = {
            imdbid: movieInfo.imdb_id,

            movieName: movieInfo.title,
            originalName: movieInfo.original_title,
            tagline: movieInfo.tagline,
            genres: JSON.stringify(movieInfo.genres.map((i: { name: string }) => i.name)),

            originalLanguage: movieInfo.original_language,

            budget: movieInfo.budget,
            revenue: movieInfo.revenue,

            runtime: movieInfo.runtime,

            overview: movieInfo.overview,
            popularity: movieInfo.popularity,
            releaseDate: movieInfo.release_date,

            _set: movieInfo.belongs_to_collection as MovieSetInfo | null
        };

        return data;
    }
}
