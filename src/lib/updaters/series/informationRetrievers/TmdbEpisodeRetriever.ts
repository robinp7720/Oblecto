import { optionalMetadata, validCreditLists } from '../../common/optionalMetadata.js';
import logger from '../../../../submodules/logger/index.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type Oblecto from '../../../oblecto/index.js';
import type { Episode } from '../../../../models/episode.js';
import type { Series } from '../../../../models/series.js';
import type { RetrievedCredit } from '../../common/CreditSync.js';

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
            season_number: Number(episode.airedSeason),
            episode_number: Number(episode.airedEpisodeNumber)
        }, { timeout: 5000 }));

        logger.debug(`Episode information for ${episode.episodeName} retrieved from tmdb`);

        const credits: RetrievedCredit[] = [
            ...(validCreditLists(episodeInfo, 'guest_stars') ? episodeInfo.guest_stars ?? [] : []).map((credit, index) => ({
                tmdbid: credit.id ?? 0,
                name: credit.name ?? '',
                profilePath: credit.profile_path,
                creditType: 'cast' as const,
                character: credit.character,
                sortOrder: credit.order ?? index
            })),
            ...(validCreditLists(episodeInfo, 'guest_stars') ? episodeInfo.crew ?? [] : []).map((credit, index) => ({
                tmdbid: credit.id ?? 0,
                name: credit.name ?? '',
                profilePath: credit.profile_path,
                knownForDepartment: credit.known_for_department,
                creditType: 'crew' as const,
                job: credit.job,
                department: credit.department,
                sortOrder: index
            }))
        ];

        const data: Record<string, unknown> = {
            episodeName: episodeInfo.name,
            airedEpisodeNumber: episodeInfo.episode_number,
            airedSeason: episodeInfo.season_number,
            overview: episodeInfo.overview,
            firstAired: episodeInfo.air_date,
            runtime: episodeInfo.runtime,
            siteRatingSource: 'tmdb',
            siteRating: episodeInfo.vote_average,
            siteRatingCount: episodeInfo.vote_count,
            ...(validCreditLists(episodeInfo, 'guest_stars') ? { _credits: credits } : {})
        };

        let externalIds: { tvdb_id?: number | null; imdb_id?: string | null } = {};

        if (!(episode.tvdbid && episode.imdbid)) {
            logger.debug(`External ids for ${episode.episodeName} missing`);

            externalIds = await optionalMetadata(() => promiseTimeout(this.oblecto.tmdb.episodeExternalIds({
                id: series.tmdbid!,
                season_number: Number(episode.airedSeason),
                episode_number: Number(episode.airedEpisodeNumber)
            }, { timeout: 5000 })), `TMDB episode ${episode.id} external IDs`) ?? {};

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
