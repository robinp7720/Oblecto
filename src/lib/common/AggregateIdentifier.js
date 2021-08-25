import IdentificationError from '../errors/IdentificationError';
import logger from '../../submodules/logger';
import MediaIdentifier from '../indexers/MediaIdentifier';

// TODO: Combine this with the AggregateUpdateRetriever
// This is no reason to have two seperate classes that basically do the same thing

export default class AggregateIdentifier {
    /**
     * Wrapper class to combine multiple identifiers and return information as a combined json output
     */
    constructor() {
        this.identifiers = [];
    }

    /**
     * Load another MediaIdentifier to be used
     *
     * @param {MediaIdentifier} identifier - Identifier object
     */
    loadIdentifier(identifier) {
        this.identifiers.push(identifier);
    }

    async identify (...args) {
        let identification = {};

        for (let identifier of this.identifiers) {
            let currentIdentification;

            try {
                currentIdentification = await identifier.identify(...args);
            } catch (e) {
                logger.log(e);
                continue;
            }

            identification = { ...identification, ...currentIdentification };
        }

        // Cleanup the input data to make sure that the data is predictable
        for (let key of Object.keys(identification)) {
            // Remove strings from retrieved information if they are empty.
            // The imdbid is a string which would be null if no id supplied.
            // The empty string however causes issues.
            // Hence, they must be removed
            if (identification[key] === '') delete identification[key];
        }

        if (Object.keys(identification).length === 0) throw new IdentificationError(`Could not identify: ${args[0]}`);

        return identification;
    }
}
