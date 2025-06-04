import IdentificationError from '../../../errors/IdentificationError';
import EpisodeIdentifier from '../EpisodeIdentifier';
import promiseTimeout from '../../../../submodules/promiseTimeout';

import { Series } from '../../../../models/series';

export default class TvdbEpisodeIdentifier extends EpisodeIdentifier {
    constructor(oblecto) {
        super(oblecto);

        this.episodeCache = {};
    }

    /**
     * Get all episodes from TVDB from a given TVDB series id
     *
     * @param {number} tvdbId - TVDBID for the series to get episodes for
     * @returns {Promise<*>} - Object containing all episodes of a series
     */
    async getEpisodes(tvdbId) {
        // TODO: Caching should be moved somewhere else or at least improved. This implementation is terrible
        if (this.episodeCache[tvdbId]) {
            return this.episodeCache[tvdbId];
        }

        if (Object.keys(this.episodeCache).length > 100) this.episodeCache = {};

        this.episodeCache[tvdbId] = await promiseTimeout(this.oblecto.tvdb.getEpisodesBySeriesId(tvdbId));

        return this.episodeCache[tvdbId];
    }

    /**
     * Match an episode to given guessit identification
     *
     * @param {Series} series - series to a match a guessit identification to
     * @param {*} guessitIdentification - Guessit identification of a file
     *
     * @returns {Promise<*>} - Match an episode to a guessit Identification
     */
    async retrieveEpisode(series, guessitIdentification) {
        let tvdbEpisodes = await this.getEpisodes(series.tvdbid);

        for (let episode of tvdbEpisodes) {
            if (episode.episodeName === guessitIdentification.episode_name) return episode;

            if (episode.airedSeason !== guessitIdentification.season) continue;
            if (episode.airedEpisodeNumber !== guessitIdentification.episode) continue;

            return episode;
        }

        throw new IdentificationError();
    }

    /**
     *  Identify an episode using TVDB
     *
     * @param {string} path - Path to the episode to be identified
     * @param {*} guessitIdentification - Guessit identification object
     * @param {Series} series - Series to which the episode should belong
     * @returns {Promise<{overview: *, tmdbid: *, episodeName: *, firstAired: *, airedSeason: *, airedEpisodeNumber: *}>} - Returns a metadata object for an episode
     */
    async identify(path, guessitIdentification, series) {
        if (!series.tvdbid) throw new IdentificationError('tvdbid was not supplied');

        let episode = await this.retrieveEpisode(series, guessitIdentification);

        return {
            tvdbid: episode.id,
            imdbid: episode.imdbId,

            episodeName: episode.episodeName,

            airedEpisodeNumber: episode.airedEpisodeNumber,
            airedSeason: episode.airedSeason,
            dvdEpisodeNumber: episode.dvdEpisodeNumber,
            dvdSeason: episode.dvdSeason,

            absoluteNumber: episode.absoluteNumber,

            overview: episode.overview,
            firstAired: episode.firstAired
        };
    }
}
