import IdentificationError from '../../../errors/IdentificationError';
import EpisodeIdentifier from '../EpisodeIdentifier';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TvdbEpisodeIdentifier extends EpisodeIdentifier {
    constructor(oblecto) {
        super(oblecto);

        this.episodeCache = {};
    }

    async getEpisodes(tvdbId) {
        // TODO: Caching should be moved somewhere else or at least improved. This implementation is terrible
        if (this.episodeCache[tvdbId]) {
            return this.episodeCache[tvdbId];
        }

        if (this.episodeCache.length > 100) this.episodeCache = {};

        this.episodeCache[tvdbId] = await promiseTimeout(this.oblecto.tvdb.getEpisodesBySeriesId(tvdbId));

        return this.episodeCache[tvdbId];
    }

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
