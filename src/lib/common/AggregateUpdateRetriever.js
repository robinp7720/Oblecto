import logger from '../../submodules/logger';
import IdentificationError from '../errors/IdentificationError';

export default class AggregateUpdateRetriever {
    /**
     * Wrapper class to combine multiple entity updaters and return information as a combined json output
     */
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

                information = { ...information, ...currentInformation };
            } catch (e) {
                logger.log(e);
            }
        }

        // Cleanup the input data to make sure that the data is predictable
        for (let key of Object.keys(information)) {
            // Remove strings from retrieved information if they are empty.
            // The imdbid is a string which would be null if no id supplied.
            // The empty string however causes issues.
            // Hence, they must be removed
            if (information[key] === '') delete information[key];
        }

        if (Object.keys(information).length === 0) throw new IdentificationError('No identification match could be found');

        return information;
    }
}
