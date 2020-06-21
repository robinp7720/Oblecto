import tmdb from '../../../../submodules/tmdb';

export default class TmdbEpisodeRetriever {
    async retrieveEpisodeInformation(episode) {
        let series = await episode.getTvshow();

        let episodeInfo = await tmdb.tvEpisodeInfo({
            id: series.tmdbid,
            season_number: episode.airedSeason,
            episode_number: episode.airedEpisodeNumber

        });

        let data = {
            episodeName: episodeInfo.name,
            airedEpisodeNumber: episodeInfo.episode_number,
            airedSeason: episodeInfo.season_number,
            overview: episodeInfo.overview
        };

        let externalIds = {};

        if (!(episode.tvdbid && episode.imdbid)) {
            externalIds = await tmdb.tvEpisodeExternalIds({
                id: series.tmdbid,
                season_number: episode.airedSeason,
                episode_number: episode.airedEpisodeNumber
            });
        }

        if (!episode.tvdbid) {
            data.tvdbid = externalIds.tvdb_id;
        }

        if (!episode.imdbid) {
            data.imdbid = externalIds.imdb_id;
        }

        return data;

    }
}
