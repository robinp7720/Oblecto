export default class AggregateMovieArtworkRetriever {
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveFanart(movie) {
        for (let retriever of this.retrievers) {
            let url;

            try {
                url = await retriever.retrieveFanart(movie);
            } catch(e) {
                console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
                continue;
            }

            if (!url) continue;

            return url;
        }

        throw new Error();
    }

    async retrievePoster(movie) {
        for (let retriever of this.retrievers) {
            let url;

            try {
                url = await retriever.retrievePoster(movie);
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
