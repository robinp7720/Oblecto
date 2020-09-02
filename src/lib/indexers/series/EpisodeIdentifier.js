import MediaIdentifier from '../MediaIdentifier';

export default class EpisodeIdentifier extends MediaIdentifier {
    /**
     * Identify an Episode based a file path and series information
     * @param {String} path File path to the Episode
     * @param series Series object from Sequalize
     * @returns {Promise<JSON>}
     */
    async identify(path, series) {

    }
}
