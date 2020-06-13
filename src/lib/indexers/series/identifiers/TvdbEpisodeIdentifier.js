import guessit from '../../../../submodules/guessit';
import tvdb from '../../../../submodules/tvdb';

export default class TvdbEpisodeIdentifier {
    constructor() {
        this.episodeCache = {};
    }

    /**
     *
     * @param path
     * @param series
     * @returns {Promise<{}|{overview: string, tvdbId: number, imdbId: string, absoluteNumber: number, tvdb: {airedSeasonId: number}, firstAired: string, dvdEpisodeNumber: number, title: string, airedSeasonNumber: number, airedEpisodeNumber: number, dvdSeasonNumber: number}>}
     */
    async getEpisodes(tvdbId) {
        // TODO; We should probably move caching directly into the library
        if (this.episodeCache[tvdbId]) {
            return this.episodeCache[tvdbId];
        }

        this.episodeCache[tvdbId] = await tvdb.getEpisodesBySeriesId(tvdbId);
        return this.episodeCache[tvdbId];
    }

    async identify(path, series) {
        if (!series.tvdbId)
            throw new Error('No TVDB available');

        const guessitIdentification = await guessit.identify(path);

        // Some single  season shows don't have a season in the title, therefor whe should set it to 1 by default
        if (!guessitIdentification.season)
            guessitIdentification.season = 1;

        let tvdbEpisodes = await this.getEpisodes(series.tvdbId);

        for (let i in tvdbEpisodes) {
            let episode = tvdbEpisodes[i];

            if (
                (episode.airedSeason === guessitIdentification.season &&
                    episode.airedEpisodeNumber === guessitIdentification.episode) ||
                episode.episodeName === guessitIdentification.episode_name
            ) {
                return {
                    tvdbId: episode.id,
                    imdbId: episode.imdbId,

                    episodeName: episode.episodeName,

                    airedEpisodeNumber: episode.airedEpisodeNumber,
                    airedSeasonNumber: episode.airedSeason,
                    dvdEpisodeNumber: episode.dvdEpisodeNumber,
                    dvdSeasonNumber: episode.dvdSeason,

                    absoluteNumber: episode.absoluteNumber,

                    overview: episode.overview,
                    firstAired: episode.firstAired,

                    tvdb: {
                        airedSeasonId: episode.airedSeasonID
                    }
                };
            }
        }

        throw new Error('Could not identify episode');
    }
}
