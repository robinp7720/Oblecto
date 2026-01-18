import logger from '../../../../submodules/logger/index.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type Oblecto from '../../../oblecto/index.js';
import type { Episode } from '../../../../models/episode.js';
import type { Series } from '../../../../models/series.js';

type EpisodeWithSeries = Episode & {
    airedSeason: string;
    airedEpisodeNumber: string;
    tvdbid: number | null;
    imdbid: string | null;
    getSeries: () => Promise<Series & { tmdbid: number | null }>;
};

export default class TmdbEpisodeRetriever {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveInformation(episode: EpisodeWithSeries): Promise<Record<string, unknown>> {
        const series = await episode.getSeries();

        if (!series.tmdbid) throw new DebugExtendableError('No tmdbid attached to series');

        const episodeInfo = await promiseTimeout(this.oblecto.tmdb.episodeInfo({
            id: series.tmdbid,
            season_number: episode.airedSeason,
            episode_number: episode.airedEpisodeNumber
        }, { timeout: 5000 }));

        logger.debug(`Episode information for ${episode.episodeName} retrieved from tmdb`);

        const data: Record<string, unknown> = {
            episodeName: episodeInfo.name,
            airedEpisodeNumber: episodeInfo.episode_number,
            airedSeason: episodeInfo.season_number,
            overview: episodeInfo.overview,
            firstAired: episodeInfo.air_date
        };

        let externalIds: { tvdb_id?: number; imdb_id?: string } = {};

        if (!(episode.tvdbid && episode.imdbid)) {
            logger.debug(`External ids for ${episode.episodeName} missing`);

            externalIds = await promiseTimeout(this.oblecto.tmdb.episodeExternalIds({
                id: series.tmdbid,
                season_number: episode.airedSeason,
                episode_number: episode.airedEpisodeNumber
            }, { timeout: 5000 }));

            logger.debug(`External ids for ${episode.episodeName} retrieved`);
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
