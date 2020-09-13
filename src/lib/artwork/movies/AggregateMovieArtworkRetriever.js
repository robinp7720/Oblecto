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
            } catch(e) {
                //console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
            }
        }

        throw new Error('Could not find a Fanart image');
    }

    async retrievePoster(movie) {
        for (let retriever of this.retrievers) {
            try {
                return await retriever.retrievePoster(movie);
            } catch(e) {
                //console.log(`Artwork url retrieval using ${retriever.constructor.name} failed`);
            }
        }

        throw new Error('Could not find a Poster image');
    }
}
