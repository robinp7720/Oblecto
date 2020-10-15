import WarnExtendableError from '../../errors/WarnExtendableError';
import logger from '../../../submodules/logger';

export default class AggregateMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveFanart(movie) {
        for (let retriever of this.retrievers) {
            try {
                return await retriever.retrieveFanart(movie);
            } catch(err) {
                logger.log(err.level || 'ERROR', err.message);
            }
        }

        throw new WarnExtendableError(`Could not find fanart of ${movie.movieName}`);
    }

    async retrievePoster(movie) {
        for (let retriever of this.retrievers) {
            try {
                return await retriever.retrievePoster(movie);
            } catch(err) {
                logger.log(err.level || 'ERROR', err.message);
            }

        }

        throw new Error(`Could not find a poster for ${movie.movieName}`);
    }
}
