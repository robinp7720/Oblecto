import AggregateIdentifier from '../../common/AggregateIdentifier';
import TmdbMovieIdentifier from './identifiers/TmdbMovieidentifier';
import { Movie } from '../../../models/movie';
import logger from '../../../submodules/logger';
import Oblecto from '../../oblecto';

export default class MovieIndexer {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.movieIdentifier = new AggregateIdentifier();

        const movieIdentifiers = {
            'tmdb': TmdbMovieIdentifier
        };

        for (let identifier of this.oblecto.config.movies.movieIdentifiers) {
            logger.log('DEBUG', `Loading ${identifier} movie identifier`);
            this.movieIdentifier.loadIdentifier(new movieIdentifiers[identifier](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('indexMovie', async (job) => await this.indexFile(job.path, job.doReIndex));
    }

    /**
     * Index file based on file path
     *
     * @param {string} moviePath - Path to Movie to be indexed
     * @returns {Promise<void>}
     */
    async indexFile(moviePath) {
        let file = await this.oblecto.fileIndexer.indexVideoFile(moviePath);

        let movieIdentification = await this.movieIdentifier.identify(moviePath);

        let [movie, movieCreated] = await Movie.findOrCreate(
            {
                where: {
                    tmdbid: movieIdentification.tmdbid
                },
                defaults: movieIdentification
            });

        movie.addFile(file);

        if (!movieCreated) return;

        this.oblecto.queue.queueJob('updateMovie', movie);
        this.oblecto.queue.queueJob('downloadMovieFanart', movie);
        this.oblecto.queue.pushJob('downloadMoviePoster', movie);
    }
}
