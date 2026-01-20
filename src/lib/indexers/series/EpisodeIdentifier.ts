import MediaIdentifier from '../MediaIdentifier.js';

import type { GuessitIdentification } from '../../../submodules/guessit.js';
import type Oblecto from '../../oblecto/index.js';
import type { SeriesIdentification } from './SeriesIdentifer.js';

export interface EpisodeIdentification {
    [key: string]: unknown;
    airedSeason?: number | null;
    airedEpisodeNumber?: number | null;
    episodeName?: string | null;
}

export type EpisodeGuessitIdentification = GuessitIdentification & {
    episode_name?: string;
    episode_title?: string;
};

export default class EpisodeIdentifier extends MediaIdentifier {
    constructor(oblecto: Oblecto) {
        super(oblecto);
    }
    /**
     * Identify an Episode based a file path and series information
     * @param path - File path to the Episode
     * @param guessitIdentification - identification object
     * @param series - Series object from Sequalize
     * @returns - Episode identification object
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async identify(path: string, guessitIdentification: EpisodeGuessitIdentification, series: SeriesIdentification): Promise<EpisodeIdentification | undefined> {

    }
}
