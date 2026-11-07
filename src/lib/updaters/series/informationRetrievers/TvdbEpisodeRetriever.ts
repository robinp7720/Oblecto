import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Dependencies } from '../../../contracts.js';
import type { Episode } from '../../../../models/episode.js';
import type { TvdbEpisode } from '../../../common/tvdbTypes.js';

type ServiceDependencies = Dependencies<'tvdb', never>;

type EpisodeWithTvdb = Episode & {
    tvdbid: number | null;
};

export default class TvdbEpisodeRetriever {
    public oblecto: ServiceDependencies;

    constructor(oblecto: ServiceDependencies) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(episode: EpisodeWithTvdb): Promise<Record<string, unknown>> {
        if (!episode.tvdbid) throw new DebugExtendableError('No tvdbid attached to episode');

        const episodeInfo = await promiseTimeout<TvdbEpisode>(this.oblecto.tvdb.getEpisodeById(episode.tvdbid));

        // Only these fields: the raw response carries TVDB's own id, which must never reach episode.update().
        const data: Record<string, unknown> = {
            episodeName: episodeInfo.episodeName,
            airedEpisodeNumber: episodeInfo.airedEpisodeNumber,
            airedSeason: episodeInfo.airedSeason,
            overview: episodeInfo.overview,
            firstAired: episodeInfo.firstAired,
            dvdEpisodeNumber: episodeInfo.dvdEpisodeNumber,
            dvdSeason: episodeInfo.dvdSeason,
            absoluteNumber: episodeInfo.absoluteNumber
        };

        if (episodeInfo.imdbId) data.imdbid = episodeInfo.imdbId;

        return data;
    }
}
