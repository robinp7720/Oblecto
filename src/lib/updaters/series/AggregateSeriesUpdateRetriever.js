import IdentificationError from '../../errors/IdentificationError';

export default class AggregateSeriesUpdateRetriever {
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveSeriesInformation(series) {
        let information = {};

        for (let retriever of this.retrievers) {
            let currentInformation;

            try {
                currentInformation = await retriever.retrieveSeriesInformation(series);
            } catch (e) {
                continue;
            }

            information = {...information, ...currentInformation};
        }

        if (Object.keys(information).length === 0) throw new Error();

        return information;
    }
}
