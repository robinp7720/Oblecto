import IdentificationError from '../../errors/IdentificationError';

export default class AggregateMovieUpdateRetriever {
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveMovieInformation(movie) {
        let information = {};

        for (let retriever of this.retrievers) {
            let currentInformation;

            try {
                currentInformation = await retriever.retrieveMovieInformation(movie);
            } catch (e) {
                continue;
            }

            information = {...information, ...currentInformation};
        }

        if (Object.keys(information).length === 0) throw new Error();

        return information;
    }
}
