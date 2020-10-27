import promiseTimeout from '../../../../submodules/promiseTimeout';
import DebugExtendableError from '../../../errors/DebugExtendableError';

export default class TvdbEpisodeRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(episode) {
        if (!episode.tvdbid) throw new DebugExtendableError('No tvdbid attached to episode');

        let episodeInfo = await promiseTimeout(this.oblecto.tvdb.getEpisodeById(episode.tvdbid));

        let data = {
            episodeName: episodeInfo.episodeName,
            airedEpisodeNumber: episodeInfo.airedEpisodeNumber,
            airedSeason: episodeInfo.airedSeason,
            overview: episodeInfo.overview,
            firstAired: episodeInfo.firstAired,
            dvdEpisodeNumber: episodeInfo.dvdEpisodeNumber,
            dvdSeason: episodeInfo.dvdSeason,
            absoluteNumber: episodeInfo.absoluteNumber,
        };

        if (episodeInfo.imdbId) data.imdbid = episodeInfo.imdbId;

        return episodeInfo;
    }
}
