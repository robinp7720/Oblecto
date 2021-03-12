import logger from '../../../../submodules/logger';
import promiseTimeout from '../../../../submodules/promiseTimeout';
import DebugExtendableError from '../../../errors/DebugExtendableError';

export default class TmdbEpisodeRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(episode) {
        let series = await episode.getSeries();

        if (!series.tmdbid) throw new DebugExtendableError('No tmdbid attached to series');

        let episodeInfo = await promiseTimeout(this.oblecto.tmdb.episodeInfo({
            id: series.tmdbid,
            season_number: episode.airedSeason,
            episode_number: episode.airedEpisodeNumber
        }, { timeout: 5000 }));

        logger.log('DEBUG',`Episode information for ${episode.episodeName} retrieved from tmdb`);

        let data = {
            episodeName: episodeInfo.name,
            airedEpisodeNumber: episodeInfo.episode_number,
            airedSeason: episodeInfo.season_number,
            overview: episodeInfo.overview,
            firstAired: episodeInfo.air_date
        };

        let externalIds = {};

        if (!(episode.tvdbid && episode.imdbid)) {
            logger.log('DEBUG',`External ids for ${episode.episodeName} missing`);

            externalIds = await promiseTimeout(this.oblecto.tmdb.episodeExternalIds({
                id: series.tmdbid,
                season_number: episode.airedSeason,
                episode_number: episode.airedEpisodeNumber
            }, { timeout: 5000 }));

            logger.log('DEBUG',`External ids for ${episode.episodeName} retrieved`);
        }

        if (!episode.tvdbid && externalIds.tvdb_id) {
            data.tvdbid = externalIds.tvdb_id;
        }

        if (!episode.imdbid && externalIds.imdb_id) {
            data.imdbid = externalIds.imdb_id;
        }

        return data;

    }
}
