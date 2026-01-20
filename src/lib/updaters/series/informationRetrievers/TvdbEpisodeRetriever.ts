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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const episodeInfo = await promiseTimeout(this.oblecto.tvdb.getEpisodeById(episode.tvdbid));

        const data = {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            episodeName: episodeInfo.episodeName,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            airedEpisodeNumber: episodeInfo.airedEpisodeNumber,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            airedSeason: episodeInfo.airedSeason,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            overview: episodeInfo.overview,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            firstAired: episodeInfo.firstAired,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            dvdEpisodeNumber: episodeInfo.dvdEpisodeNumber,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            dvdSeason: episodeInfo.dvdSeason,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            absoluteNumber: episodeInfo.absoluteNumber,
        } as any;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        if (episodeInfo.imdbId) data.imdbid = episodeInfo.imdbId;

        return episodeInfo;
    }
}
