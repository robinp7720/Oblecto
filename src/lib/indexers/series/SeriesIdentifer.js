import MediaIdentifier from '../MediaIdentifier';

export default class SeriesIdentifier extends MediaIdentifier {
    /**
     * Identify a Series of an Episode based a file path
     * @param {String} path File path to the Episode
     * @param {JSON} Guessit identification object
     * @returns {Promise<JSON>}
     */
    async identify(path, guessitIdentification) {

    }
}
