export default class AggregateUpdateRetriever {
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveInformation(...args) {
        let information = {};

        for (let retriever of this.retrievers) {
            try {
                let currentInformation = await retriever.retrieveInformation(...args);

                information = {...information, ...currentInformation};
            } catch (e) {
                console.log(e);
            }
        }

        if (Object.keys(information).length === 0) throw new Error();

        return information;
    }
}
