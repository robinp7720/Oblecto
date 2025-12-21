import MediaIdentifier from '../MediaIdentifier';

export default class SeriesIdentifier extends MediaIdentifier {
    /**
     * Identify a Series of an Episode based a file path
     * @param {string} path - File path to the Episode
     * @param {*} guessitIdentification - Guessit identification object
     * @returns {Promise<JSON>} - Series identification object
     */
    async identify(path, guessitIdentification) {

    }
}
