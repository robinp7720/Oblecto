import MovieIdentifier, { MovieIdentification } from '../MovieIdentifier.js';
import IdentificationError from '../../../errors/IdentificationError.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import type { GuessitIdentification } from '../../../../submodules/guessit.js';
import type Oblecto from '../../../oblecto/index.js';

export default class TmdbMovieIdentifier extends MovieIdentifier {
    constructor(oblecto: Oblecto) {
        super(oblecto);
    }
    /**
     * Identify a Movie based a file path
     * @param moviePath File path to the Movie
     * @param guessitIdentification - Guessit identification object
     * @returns - Movie identification object
     */
    async identify(moviePath: string, guessitIdentification: GuessitIdentification): Promise<MovieIdentification> {
        const query: { query: string; primary_release_year?: number } = { query: guessitIdentification.title };

        if (guessitIdentification.year !== undefined && guessitIdentification.year !== null) {
            query.primary_release_year = guessitIdentification.year;
        }

        const res = await promiseTimeout(this.oblecto.tmdb.searchMovie(query, { timeout: 5000 })) as {
            results: Array<{
                id: number;
                title: string;
                overview?: string;
            }>;
        };

        const identifiedMovie = res.results[0] as {
            id: number;
            title: string;
            overview?: string;
        } | undefined;

        if (identifiedMovie === undefined) {
            throw new IdentificationError(
                `Could not identify movie "${guessitIdentification.title}"${(guessitIdentification.year !== undefined && guessitIdentification.year !== null) ? ` (${guessitIdentification.year})` : ''} using TMDB`
            );
        }

        return {
            tmdbid: identifiedMovie.id,
            movieName: identifiedMovie.title,
            overview: identifiedMovie.overview,
        };
    }

}
