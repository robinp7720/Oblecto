import MediaIdentifier from '../MediaIdentifier.js';
import type Oblecto from '../../oblecto/index.js';
import type { GuessitIdentification } from '../../../submodules/guessit.js';

export interface MovieIdentification {
    [key: string]: unknown;
    tmdbid?: number | null;
    movieName?: string | null;
    overview?: string | null;
}

export default class MovieIdentifier extends MediaIdentifier {
    constructor(oblecto: Oblecto) {
        super(oblecto);
    }
    /**
     * Identify a Movie based a file path
     * @param {string} moviePath File path to the Movie
     * @param {*} guessitIdentification - Guessit identification object
     * @returns {Promise<*>} - Movie identification object
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async identify(moviePath: string, guessitIdentification: GuessitIdentification): Promise<MovieIdentification | undefined> {

    }
}
