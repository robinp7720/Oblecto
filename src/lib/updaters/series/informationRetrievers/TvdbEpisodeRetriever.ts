import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type Oblecto from '../../../oblecto/index.js';
import type { Episode } from '../../../../models/episode.js';

type EpisodeWithTvdb = Episode & {
    tvdbid: number | null;
};

export default class TvdbEpisodeRetriever {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(episode: EpisodeWithTvdb): Promise<unknown> {
        if (!episode.tvdbid) throw new DebugExtendableError('No tvdbid attached to episode');

        const episodeInfo = await promiseTimeout(this.oblecto.tvdb.getEpisodeById(episode.tvdbid));

        const data = {
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
