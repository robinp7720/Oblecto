import guessit from '../../../../submodules/guessit';
import tvdb from '../../../../submodules/tvdb';
import VideoIdentificationError from '../../../errors/VideoIdentificationError';
import IdentificationError from '../../../errors/IdentificationError';

export default class TvdbEpisodeIdentifier {
    constructor() {
        this.episodeCache = {};
    }

    async getEpisodes(tvdbId) {
        // TODO; We should probably move caching directly into the library
        if (this.episodeCache[tvdbId]) {
            return this.episodeCache[tvdbId];
        }

        if (this.episodeCache.length > 100) this.episodeCache = {};

        this.episodeCache[tvdbId] = await tvdb.getEpisodesBySeriesId(tvdbId);

        return this.episodeCache[tvdbId];
    }

    retrieveEpisode(tvdbEpisodes, guessitIdentification) {
        for (let episode of tvdbEpisodes) {
            if (episode.episodeName === guessitIdentification.episode_name) return episode;

            if (episode.airedSeason !== guessitIdentification.season) continue;
            if (episode.airedEpisodeNumber !== guessitIdentification.episode) continue;

            return episode;
        }

        throw new VideoIdentificationError();
    }

    async identify(path, series) {
        if (!series.tvdbid) throw new IdentificationError('tvdbid was not supplied');

        const guessitIdentification = await guessit.identify(path);

        // Some single  season shows don't have a season in the title, therefor whe should set it to 1 by default
        if (!guessitIdentification.season) {
            guessitIdentification.season = 1;
        }

        let tvdbEpisodes = await this.getEpisodes(series.tvdbid);

        let episode = this.retrieveEpisode(tvdbEpisodes, guessitIdentification);

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
