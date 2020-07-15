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
            let url;

            try {
                url = await retriever.retrieveEpisodeBanner(episode);
            } catch(e) {
                console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
                continue;
            }

            if (!url) continue;

            return url;
        }

        throw new Error();
    }

    async retrieveSeriesPoster(series) {
        for (let retriever of this.retrievers) {
            let url;

            try {
                url = await retriever.retrieveSeriesPoster(series);
            } catch(e) {
                console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
                continue;
            }

            if (!url) continue;

            return url;
        }

        throw new Error();
    }
}
