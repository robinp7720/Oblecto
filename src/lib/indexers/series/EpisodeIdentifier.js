import MediaIdentifier from '../MediaIdentifier';

import { Series } from '../../../models/series';

export default class EpisodeIdentifier extends MediaIdentifier {
    /**
     * Identify an Episode based a file path and series information
     * @param {string} path - File path to the Episode
     * @param {*} guessitIdentification - identification object
     * @param {Series} series - Series object from Sequalize
     * @returns {Promise<JSON>} - Episode identification object
     */
    async identify(path, guessitIdentification, series) {

    }
}
