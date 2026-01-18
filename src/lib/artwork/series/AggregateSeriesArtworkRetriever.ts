import WarnExtendableError from '../../errors/WarnExtendableError.js';
import logger from '../../../submodules/logger/index.js';
import DebugExtendableError from '../../errors/DebugExtendableError.js';
import Downloader from '../../downloader/index.js';

import type Oblecto from '../../oblecto/index.js';
import type { Episode } from '../../../models/episode.js';
import type { Series } from '../../../models/series.js';

type SeriesArtworkRetriever = {
    retrieveEpisodeBanner: (episode: Episode) => Promise<string[]>;
    retrieveSeriesPoster: (series: Series) => Promise<string[]>;
};

export default class AggregateSeriesArtworkRetriever {
    public oblecto: Oblecto;
    private retrievers: SeriesArtworkRetriever[];

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.retrievers = [];
    }

    loadRetriever(retriever: SeriesArtworkRetriever): void {
        this.retrievers.push(retriever);
    }

    async retrieveEpisodeBanner(episode: Episode): Promise<void> {
        for (const retriever of this.retrievers) {
            try {
                const urls = await retriever.retrieveEpisodeBanner(episode);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.episodeBannerPath(episode));
            } catch(e) {
                const err = e as Error & { level?: string };

                logger.log(err.level ?? 'error', `${retriever.constructor.name}: ${err.message}`);
            }
        }

        throw new WarnExtendableError(`No banner found for episode ${episode.episodeName}`);
    }

    async retrieveSeriesPoster(series: Series): Promise<void> {
        for (const retriever of this.retrievers) {
            try {
                const urls = await retriever.retrieveSeriesPoster(series);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.seriesPosterPath(series));
            } catch(e) {
                const err = e as Error & { level?: string };

                logger.log(err.level ?? 'error', `${retriever.constructor.name}: ${err.message}`);
            }
        }

        throw new WarnExtendableError(`No poster found for ${series.seriesName}`);
    }
}
