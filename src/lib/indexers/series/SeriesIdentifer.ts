import MediaIdentifier from '../MediaIdentifier.js';
import type Oblecto from '../../oblecto/index.js';
import type { GuessitIdentification } from '../../../submodules/guessit.js';

export interface SeriesIdentification {
    [key: string]: unknown;
    tvdbid?: number | null;
    tmdbid?: number | null;
    seriesName?: string | null;
    overview?: string | null;
}

export default class SeriesIdentifier extends MediaIdentifier {
    constructor(oblecto: Oblecto) {
        super(oblecto);
    }
    /**
     * Identify a Series of an Episode based a file path
     * @param path - File path to the Episode
     * @param guessitIdentification - Guessit identification object
     * @returns - Series identification object
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async identify(path: string, guessitIdentification: GuessitIdentification): Promise<SeriesIdentification | undefined> {

    }
}
