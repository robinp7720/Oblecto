import MediaIdentifier from '../MediaIdentifier';

export default class MovieIdentifier extends MediaIdentifier {
    /**
     * Identify a Movie based a file path
     * @param {string} moviePath File path to the Movie
     * @param {*} guessitIdentification - Guessit identification object
     * @returns {Promise<*>} - Movie identification object
     */
    async identify(moviePath, guessitIdentification) {

    }
}
