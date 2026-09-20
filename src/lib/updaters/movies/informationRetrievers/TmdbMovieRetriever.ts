import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import { optionalMetadata, validCreditLists } from '../../common/optionalMetadata.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import type { Movie } from '../../../../models/movie.js';
import type Oblecto from '../../../oblecto/index.js';
import type { RetrievedCredit } from '../../common/CreditSync.js';

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
        if (movie.tmdbid === null) throw new DebugExtendableError('No tmdbid attached to movie');

        const [retrievedInfo, movieCredits] = await Promise.all([
            optionalMetadata(() => promiseTimeout(this.oblecto.tmdb.movieInfo({ id: movie.tmdbid! }, { timeout: 5000 })), `TMDB movie ${movie.id} metadata`),
            optionalMetadata(() => promiseTimeout(this.oblecto.tmdb.movieCredits({ id: movie.tmdbid! }, { timeout: 5000 })), `TMDB movie ${movie.id} credits`, validCreditLists)
        ]);
        const movieInfo = retrievedInfo ?? {};

        const credits: RetrievedCredit[] = [
            ...(validCreditLists(movieCredits) ? movieCredits?.cast ?? [] : []).map((credit, index) => ({
                tmdbid: credit.id ?? 0,
                name: credit.name ?? '',
                profilePath: credit.profile_path,
                knownForDepartment: credit.known_for_department,
                creditType: 'cast' as const,
                character: credit.character,
                sortOrder: credit.order ?? index
            })),
            ...(validCreditLists(movieCredits) ? movieCredits?.crew ?? [] : []).map((credit, index) => ({
                tmdbid: credit.id ?? 0,
                name: credit.name ?? '',
                profilePath: credit.profile_path,
                knownForDepartment: credit.known_for_department,
                creditType: 'crew' as const,
                job: credit.job,
                department: credit.department,
                sortOrder: index
            }))
        ];

        const data: Record<string, unknown> = {
            imdbid: movieInfo.imdb_id,

            movieName: movieInfo.title,
            originalName: movieInfo.original_title,
            tagline: movieInfo.tagline,
            genres: JSON.stringify((movieInfo.genres ?? []).map(genre => genre.name)),

            originalLanguage: movieInfo.original_language,

            budget: movieInfo.budget,
            revenue: movieInfo.revenue,

            runtime: movieInfo.runtime,

            overview: movieInfo.overview,
            popularity: movieInfo.popularity,
            siteRatingSource: 'tmdb',
            siteRating: movieInfo.vote_average,
            siteRatingCount: movieInfo.vote_count,
            releaseDate: movieInfo.release_date,

            _set: movieInfo.belongs_to_collection as MovieSetInfo | null,
            ...(validCreditLists(movieCredits) ? { _credits: credits } : {})
        };

        return data;
    }
}
