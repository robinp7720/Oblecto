export default class AggregateEpisodeUpdateRetriever {
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever) {
        this.retrievers.push(retriever);
    }

    async retrieveEpisodeInformation(episode) {
        let information = {};

        for (let retriever of this.retrievers) {
            let currentInformation;

            try {
                currentInformation = await retriever.retrieveEpisodeInformation(episode);
            } catch (e) {
                console.log(e);
                continue;
            }

            information = {...information, ...currentInformation};
        }

        if (Object.keys(information).length === 0) throw new Error();

        return information;
    }
}
