import WarnExtendableError from '../../errors/WarnExtendableError.js';
import logger from '../../../submodules/logger/index.js';
import Downloader from '../../downloader/index.js';
import DebugExtendableError from '../../errors/DebugExtendableError.js';

import type Oblecto from '../../oblecto/index.js';
import type { Movie } from '../../../models/movie.js';

type MovieArtworkRetriever = {
    retrieveFanart: (movie: Movie) => Promise<string[]>;
    retrievePoster: (movie: Movie) => Promise<string[]>;
};

export default class AggregateMovieArtworkRetriever {
    public oblecto: Oblecto;
    private retrievers: MovieArtworkRetriever[];

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.retrievers = [];
    }

    loadRetriever(retriever: MovieArtworkRetriever): void {
        this.retrievers.push(retriever);
    }

    async retrieveFanart(movie: Movie): Promise<void> {
        for (const retriever of this.retrievers) {
            try {
                const urls = await retriever.retrieveFanart(movie);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.movieFanartPath(movie));
            } catch(e) {
                const err = e as Error & { level?: string };

                logger.log(err.level ?? 'error', `${retriever.constructor.name}: ${err.message}`);
            }
        }

        throw new WarnExtendableError(`No fanart found for movie ${movie.movieName}`);
    }

    async retrievePoster(movie: Movie): Promise<void> {
        for (const retriever of this.retrievers) {
            try {
                const urls = await retriever.retrievePoster(movie);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.moviePosterPath(movie));
            } catch(e) {
                const err = e as Error & { level?: string };

                logger.log(err.level ?? 'error', `${retriever.constructor.name}: ${err.message}`);
            }
        }

        throw new WarnExtendableError(`No poster found for movie ${movie.movieName}`);
    }
}
