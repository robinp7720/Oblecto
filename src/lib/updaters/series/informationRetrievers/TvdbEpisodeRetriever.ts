import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type Oblecto from '../../../oblecto/index.js';
import type { Episode } from '../../../../models/episode.js';
import type { TvdbEpisode } from '../../../common/tvdbTypes.js';

type EpisodeWithTvdb = Episode & {
    tvdbid: number | null;
};

export default class TvdbEpisodeRetriever {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(episode: EpisodeWithTvdb): Promise<Record<string, unknown>> {
        if (!episode.tvdbid) throw new DebugExtendableError('No tvdbid attached to episode');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
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
