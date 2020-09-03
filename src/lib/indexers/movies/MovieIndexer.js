import AggregateIdentifier from '../../common/AggregateIdentifier';
import databases from '../../../submodules/database';
import TmdbMovieIdentifier from './identifiers/TmdbMovieidentifier';

export default class MovieIndexer {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.movieIdentifer = new AggregateIdentifier();

        this.movieIdentifer.loadIdentifier(new TmdbMovieIdentifier(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('indexMovie', async (job) => await this.indexFile(job.path, job.doReIndex));
    }

    async indexFile(moviePath) {
        let file = await this.oblecto.fileIndexer.indexVideoFile(moviePath);

        let movieIdentification = await this.movieIdentifer.identify(moviePath);

        let [movie, movieCreated] = await databases.movie.findOrCreate(
            {
                where: {
                    tmdbid: movieIdentification.tmdbid
                },
                defaults: movieIdentification
            });


        movie.addFile(file);

        if (movieCreated) {
            this.oblecto.queue.queueJob('updateMovie', movie);
            this.oblecto.queue.queueJob('downloadMovieFanart', movie);
            this.oblecto.queue.pushJob('downloadMoviePoster', movie);
        }
    }
}
