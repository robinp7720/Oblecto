import IdentificationError from '../../../errors/IdentificationError';
import EpisodeIdentifier from '../EpisodeIdentifier';
import promiseTimeout from '../../../../submodules/promiseTimeout';

import { Series } from '../../../../models/series';

export default class TmdbEpisodeIdentifier extends EpisodeIdentifier {
    /**
     *  Identify an episode using TMDB
     * @param {string} path - Path to the episode to be identified
     * @param {*} guessitIdentification - Guessit identification object
     * @param {Series} series - Series to which the episode should belong
     * @returns {Promise<{overview: *, tmdbid: *, episodeName: *, firstAired: *, airedSeason: *, airedEpisodeNumber: *}>} - Identification object
     */
    async identify(path, guessitIdentification, series) {
        if (!series.tmdbid) throw new IdentificationError('Series does not have a TMDB ID');

        let episode;

        try {
            episode = await promiseTimeout(this.oblecto.tmdb.episodeInfo({
                id: series.tmdbid,
                season_number: guessitIdentification.season || 1,
                episode_number: guessitIdentification.episode
            }, { timeout: 5000 }));
        } catch (e) {
            throw new IdentificationError('Could not find episode');
        }

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
