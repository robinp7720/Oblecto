import guessit from '../../../../submodules/guessit';
import tmdb from '../../../../submodules/tmdb';

export default class TmdbEpisodeIdentifier {
    constructor() {
        this.episodeCache = {};
    }

    async identify(path, series) {
        if (!series.tmdbId)
            return {};

        const guessitIdentification = await guessit.identify(path);

        try {
            let episode = await tmdb.tvEpisodeInfo({
                id: series.tmdbId,
                season_number: guessitIdentification.season,
                episode_number: guessitIdentification.episode
            });

            return {
                tmdbId: episode.id,

                title: episode.name,
                airedEpisodeNumber: episode.episode_number,
                airedSeasonNumber: episode.season_number,

                overview: episode.overview,
                firstAired: episode.airDate

            };
        } catch (e) {
            return {};
        }
    }
}
