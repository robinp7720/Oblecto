import MediaIdentifier from '../MediaIdentifier.js';
import type { GuessitIdentification } from '../../../submodules/guessit.js';

export interface SeriesIdentification {
    [key: string]: unknown;
    tvdbid?: number | null;
    tmdbid?: number | null;
    seriesName?: string | null;
    overview?: string | null;
}

export default class SeriesIdentifier<D extends object = object> extends MediaIdentifier<D> {
    constructor(oblecto: D) {
        super(oblecto);
    }
    /**
     * Identify a Series of an Episode based a file path
     * @param path - File path to the Episode
     * @param guessitIdentification - Guessit identification object
     * @returns - Series identification object
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    identify(path: string, guessitIdentification: GuessitIdentification): Promise<SeriesIdentification | undefined> {
        return Promise.reject(new Error(`${this.constructor.name} does not implement identify`));
    }
}
