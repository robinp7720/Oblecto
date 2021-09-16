import WarnExtendableError from '../../errors/WarnExtendableError';
import logger from '../../../submodules/logger';
import Downloader from '../../downloader';
import DebugExtendableError from '../../errors/DebugExtendableError';

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
                const urls = await retriever.retrieveFanart(movie);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.movieFanartPath(movie));
            } catch(e) {
                logger.log(e.level, `${retriever.constructor.name}: ${e.message}`);
            }
        }

        throw new WarnExtendableError(`No fanart found for movie ${movie.movieName}`);
    }

    async retrievePoster(movie) {
        for (let retriever of this.retrievers) {
            try {
                const urls = await retriever.retrievePoster(movie);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.moviePosterPath(movie));
            } catch(e) {
                logger.log(e.level, `${retriever.constructor.name}: ${e.message}`);
            }
        }

        throw new WarnExtendableError(`No poster found for movie ${movie.movieName}`);
    }
}
