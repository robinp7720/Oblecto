import AggregateIdentifier from '../../common/AggregateIdentifier';
import TmdbMovieIdentifier from './identifiers/TmdbMovieidentifier';
import { Movie } from '../../../models/movie';
import logger from '../../../submodules/logger';
import guessit from '../../../submodules/guessit';
import IdentificationError from '../../errors/IdentificationError';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 */

export default class MovieIndexer {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.movieIdentifier = new AggregateIdentifier();

        const movieIdentifiers = { 'tmdb': TmdbMovieIdentifier };

        for (let identifier of this.oblecto.config.movies.movieIdentifiers) {
            logger.debug( `Loading ${identifier} movie identifier`);
            this.movieIdentifier.loadIdentifier(new movieIdentifiers[identifier](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('indexMovie', async (job) => await this.indexFile(job.path, job.doReIndex));
    }

    async matchFile(moviePath) {
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
     * @param {string} moviePath - Path to Movie to be indexed
     * @param {boolean} doReindex - Whether or not to reindex a file if it has already been indexed
     * @returns {Promise<void>}
     */
    async indexFile(moviePath, doReindex) {
        const file = await this.oblecto.fileIndexer.indexVideoFile(moviePath);

        let movieIdentification;
        try {
            movieIdentification = await this.matchFile(moviePath);
        } catch (e) {
            if (e.name === 'IdentificationError') {
                 await file.update({ problematic: true, error: e.message });
                 return;
            }
            throw e;
        }

        let [movie, movieCreated] = await Movie.findOrCreate(
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
