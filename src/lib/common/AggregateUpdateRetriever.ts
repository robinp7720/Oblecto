import logger from '../../submodules/logger';
import IdentificationError from '../errors/IdentificationError';

type InformationRetriever = {
    retrieveInformation: (...args: unknown[]) => Promise<Record<string, unknown>>;
};

export default class AggregateUpdateRetriever {
    private retrievers: InformationRetriever[];

    /**
     * Wrapper class to combine multiple entity updaters and return information as a combined json output
     */
    constructor() {
        this.retrievers = [];
    }

    loadRetriever(retriever: InformationRetriever): void {
        this.retrievers.push(retriever);
    }

    async retrieveInformation(...args: unknown[]): Promise<Record<string, unknown>> {
        let information: Record<string, unknown> = {};

        for (let retriever of this.retrievers) {
            try {
                let currentInformation = await retriever.retrieveInformation(...args);

                information = { ...information, ...currentInformation };
            } catch (e) {
                logger.error(e);
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
