import guessit from '../../../../submodules/guessit';
import tvdb from '../../../../submodules/tvdb';

export default class TvdbEpisodeIdentifier {
    constructor () {
        this.episodeCache = {};
    }
    async Identify (path, tvdbId){
        const guessitIdentification = await guessit.identify(path);

        let tvdbEpisodes = await tvdb.getEpisodesBySeriesId(tvdbId);

        for (let i in tvdbEpisodes) {
            let episode = tvdbEpisodes[i];

            if (
                (episode.airedSeason        === guessitIdentification.season &&
                episode.airedEpisodeNumber === guessitIdentification.episode) ||
                episode.episodeName === guessitIdentification.episode_name
            ) {
                return episode;
            }
        }
    }
}
