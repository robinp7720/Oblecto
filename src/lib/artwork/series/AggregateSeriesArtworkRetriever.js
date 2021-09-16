import WarnExtendableError from '../../errors/WarnExtendableError';
import logger from '../../../submodules/logger';
import DebugExtendableError from '../../errors/DebugExtendableError';
import Downloader from '../../downloader';

export default class AggregateSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveEpisodeBanner(episode) {
        for (let retriever of this.retrievers) {
            try {
                let urls = await retriever.retrieveEpisodeBanner(episode);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.episodeBannerPath(episode));
            } catch(e) {
                logger.log(e.level, `${retriever.constructor.name}: ${e.message}`);
            }
        }

        throw new WarnExtendableError(`No banner found for episode ${episode.episodeName}`);
    }

    async retrieveSeriesPoster(series) {
        for (let retriever of this.retrievers) {
            try {
                let urls = await retriever.retrieveSeriesPoster(series);

                if (urls.length === 0) throw new DebugExtendableError('No URLs found');

                return Downloader.attemptDownload(urls, this.oblecto.artworkUtils.seriesPosterPath(series));
            } catch(e) {
                logger.log(e.level, `${retriever.constructor.name}: ${e.message}`);
            }
        }

        throw new WarnExtendableError(`No poster found for ${series.seriesName}`);
    }
}
