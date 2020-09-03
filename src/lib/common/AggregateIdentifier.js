import IdentificationError from '../errors/IdentificationError';

export default class AggregateIdentifier {
    /**
     * Wrapper class to combine multiple identifiers and return information as a combined json output
     */
    constructor() {
        this.identifiers = [];
    }

    /**
     *
     * @param {MediaIdentifier} identifier
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
                continue;
            }

            identification = {...identification, ...currentIdentification};
        }

        if (Object.keys(identification).length === 0) throw new IdentificationError();

        return identification;
    }
};
