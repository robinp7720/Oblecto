import IdentificationError from '../../errors/IdentificationError';

export default class AggregateMovieIdentifier {
    constructor() {
        this.identifiers = [];
    }

    loadIdentifier(identifier) {
        this.identifiers.push(identifier);
    }

    async identify(moviePath) {
        let identification = {};

        for (let identifier of this.identifiers) {
            let currentIdentification;

            try {
                currentIdentification = await identifier.identify(moviePath);
            } catch (e) {
                continue;
            }

            identification = {...identification, ...currentIdentification};
        }

        if (Object.keys(identification).length === 0) throw new IdentificationError();

        return identification;
    }

};
