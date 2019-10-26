import guessit from '../../../../submodules/guessit';
import tvdb from '../../../../submodules/tvdb';

export default class TvdbEpisodeIdentifier {
    constructor() {
        this.episodeCache = {};
    }

    async identify(path, series) {
        const guessitIdentification = await guessit.identify(path);


        // Some single  season shows don't have a season in the title, therefor whe should set it to 1 by default
        if (!guessitIdentification.season)
            guessitIdentification.season = 1;

        let tvdbEpisodes = await tvdb.getEpisodesBySeriesId(series.tvdbId);

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

                    title: episode.episodeName,

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
    }
}
