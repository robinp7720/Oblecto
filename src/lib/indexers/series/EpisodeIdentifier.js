import MediaIdentifier from '../MediaIdentifier';

export default class EpisodeIdentifier extends MediaIdentifier {
    /**
     * Identify an Episode based a file path and series information
     * @param {String} path - File path to the Episode
     * @params {JSON} Guessit - identification object
     * @param {Series} series - Series object from Sequalize
     * @returns {Promise<JSON>}
     */
    async identify(path, guessitIdentification, series) {

    }
}
