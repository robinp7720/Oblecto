import AggregateIdentifier from '../../common/AggregateIdentifier.js';
import TmdbMovieIdentifier from './identifiers/TmdbMovieidentifier.js';
import { Movie } from '../../../models/movie.js';
import logger from '../../../submodules/logger/index.js';
import guessit, { GuessitIdentification } from '../../../submodules/guessit.js';
import IdentificationError from '../../errors/IdentificationError.js';

import type Oblecto from '../../oblecto/index.js';

interface MovieIdentification {
    [key: string]: unknown;
    tmdbid?: number | null;
    movieName?: string | null;
    overview?: string | null;
}

type MovieIdentifierConstructor = new (oblecto: Oblecto) => {
    identify: (path: string, guessit: GuessitIdentification) => Promise<MovieIdentification>;
};

export default class MovieIndexer {
    public oblecto: Oblecto;
    public movieIdentifier: AggregateIdentifier;
    public availableIdentifiers: string[];
    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.movieIdentifier = new AggregateIdentifier();

        const movieIdentifiers: Record<string, MovieIdentifierConstructor> = { 'tmdb': TmdbMovieIdentifier };

        this.availableIdentifiers = Object.keys(movieIdentifiers);

        for (const identifier of this.oblecto.config.movies.movieIdentifiers) {
            logger.debug( `Loading ${identifier} movie identifier`);
            this.movieIdentifier.loadIdentifier(new movieIdentifiers[identifier](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('indexMovie', async (job: { path: string; doReIndex?: boolean }) => {
            await this.indexFile(job.path, job.doReIndex);
        });
    }

    async matchFile(moviePath: string): Promise<MovieIdentification> {
        const guessitIdentification = await guessit.identify(moviePath);

        try {
            return await this.movieIdentifier.identify(moviePath, guessitIdentification);
        } catch (e) {
            if (guessitIdentification.year) {
                logger.info( `Could not identify ${moviePath}. Maybe the specified year is wrong?`);
                logger.info( 'Attempting to identify without year');

                delete guessitIdentification.year;

                return await this.movieIdentifier.identify(moviePath, guessitIdentification);
            }
        }

        throw new IdentificationError(`Could not identify ${moviePath}`);
    }

    /**
     * Index file based on file path
     * @param moviePath - Path to Movie to be indexed
     * @param doReindex - Whether or not to reindex a file if it has already been indexed
     * @returns
     */
    async indexFile(moviePath: string, doReindex?: boolean): Promise<void> {
        const file = await this.oblecto.fileIndexer.indexVideoFile(moviePath);

        let movieIdentification: MovieIdentification;

        try {
            movieIdentification = await this.matchFile(moviePath);
        } catch (e) {
            const error = e as Error & { name?: string; message?: string };

            if (error.name === 'IdentificationError') {
                await file.update({ problematic: true, error: error.message });
                return;
            }
            throw e;
        }

        const [movie, movieCreated] = await Movie.findOrCreate(
            {
                where: { tmdbid: movieIdentification.tmdbid },
                defaults: movieIdentification
            });

        movie.addFile(file);

        if (!movieCreated && !doReindex) return;

        this.oblecto.queue.queueJob('updateMovie', movie);
        this.oblecto.queue.queueJob('downloadMovieFanart', movie);
        this.oblecto.queue.pushJob('downloadMoviePoster', movie);
    }
}
