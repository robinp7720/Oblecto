export default class AggregateMovieArtworkRetriever {
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveFanart(movie) {
        for (let retriever of this.retrievers) {
            try {
                return await retriever.retrieveFanart(movie);
            } catch(e) {
                continue;
            }
        }
    }

    async retrievePoster(movie) {
        for (let retriever of this.retrievers) {
            try {
                return await retriever.retrievePoster(movie);
            } catch(e) {
                continue;
            }
        }
    }
}
