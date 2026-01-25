import IdentificationError from '../../../errors/IdentificationError.js';
import EpisodeIdentifier, { EpisodeGuessitIdentification, EpisodeIdentification } from '../EpisodeIdentifier.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';

import type Oblecto from '../../../oblecto/index.js';
import type { SeriesIdentification } from '../SeriesIdentifer.js';

export default class TmdbEpisodeIdentifier extends EpisodeIdentifier {
    constructor(oblecto: Oblecto) {
        super(oblecto);
    }
    /**
     *  Identify an episode using TMDB
     * @param path - Path to the episode to be identified
     * @param guessitIdentification - Guessit identification object
     * @param series - Series to which the episode should belong
     * @returns - Identification object
     */
    async identify(path: string, guessitIdentification: EpisodeGuessitIdentification, series: SeriesIdentification): Promise<EpisodeIdentification> {
        if (series.tmdbid === null || series.tmdbid === undefined) throw new IdentificationError('Series does not have a TMDB ID');
        const tmdbid = series.tmdbid;

        const episode = await promiseTimeout(this.oblecto.tmdb.episodeInfo({
            id: tmdbid,
            season_number: guessitIdentification.season ?? 1,
            episode_number: guessitIdentification.episode
        }, { timeout: 5000 }));

        return {
            tmdbid: episode.id,

            episodeName: episode.name,
            airedEpisodeNumber: episode.episode_number,
            airedSeason: episode.season_number,

            overview: episode.overview,
            firstAired: episode.air_date
        };

    }
}
