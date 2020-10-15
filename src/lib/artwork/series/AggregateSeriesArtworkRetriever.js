import WarnExtendableError from '../../errors/WarnExtendableError';

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
                return await retriever.retrieveEpisodeBanner(episode);
            } catch(e) {
                //console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
            }
        }

        throw new WarnExtendableError(`No banner found for episode ${episode.episodeName}`);
    }

    async retrieveSeriesPoster(series) {
        for (let retriever of this.retrievers) {
            try {
                return await retriever.retrieveSeriesPoster(series);
            } catch(e) {
                //console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
            }
        }

        throw new WarnExtendableError(`No poster found for ${series.seriesName}`);
    }
}
