import { optionalMetadata, validCreditLists } from '../../common/optionalMetadata.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Series } from '../../../../models/series.js';
import type Oblecto from '../../../oblecto/index.js';
import type { RetrievedCredit } from '../../common/CreditSync.js';

type SeriesWithTmdb = Series & {
    tmdbid: number | null;
    tvdbid: number | null;
    imdbid: string | null;
};

export default class TmdbSeriesRetriever {
    public oblecto: Oblecto;

    /**
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Get metadata for a series from TMDB
     * @param series - Series for which to fetch metadata
     * @returns - Updated series information
     */
    async retrieveInformation(series: SeriesWithTmdb): Promise<Record<string, unknown>> {
        if (!series.tmdbid) throw new DebugExtendableError('No tmdbid attached to series');

        const [retrievedInfo, aggregateCredits] = await Promise.all([
            optionalMetadata(() => promiseTimeout(this.oblecto.tmdb.tvInfo({ id: series.tmdbid! }, { timeout: 5000 })), `TMDB series ${series.id} metadata`),
            optionalMetadata(() => promiseTimeout(this.oblecto.tmdb.tvAggregateCredits({ id: series.tmdbid! }, { timeout: 5000 })), `TMDB series ${series.id} credits`, validCreditLists)
        ]);
        const seriesInfo = retrievedInfo ?? {};

        const credits: RetrievedCredit[] = [];
        for (const credit of validCreditLists(aggregateCredits) ? aggregateCredits?.cast ?? [] : []) {
            const roles = credit.roles?.length ? credit.roles : [{ character: credit.name, episode_count: credit.total_episode_count }];
            for (const role of roles) credits.push({
                tmdbid: credit.id ?? 0,
                name: credit.name ?? '',
                profilePath: credit.profile_path,
                knownForDepartment: credit.known_for_department,
                creditType: 'cast',
                character: role.character,
                episodeCount: role.episode_count ?? credit.total_episode_count,
                sortOrder: credit.order
            });
        }
        for (const credit of validCreditLists(aggregateCredits) ? aggregateCredits?.crew ?? [] : []) {
            const jobs = credit.jobs?.length ? credit.jobs : [];
            for (const job of jobs) credits.push({
                tmdbid: credit.id ?? 0,
                name: credit.name ?? '',
                profilePath: credit.profile_path,
                knownForDepartment: credit.known_for_department,
                creditType: 'crew',
                job: job.job,
                department: credit.department,
                episodeCount: job.episode_count,
                sortOrder: null
            });
        }
        for (const creator of seriesInfo.created_by ?? []) credits.push({
            tmdbid: creator.id ?? 0,
            name: creator.name ?? '',
            profilePath: creator.profile_path,
            knownForDepartment: 'Writing',
            creditType: 'crew',
            job: 'Creator',
            department: 'Writing',
            sortOrder: 0
        });

        const data: Record<string, unknown> = {
            seriesName: seriesInfo.name,
            status: seriesInfo.status,
            firstAired: seriesInfo.first_air_date,
            overview: seriesInfo.overview,
            popularity: seriesInfo.popularity,
            siteRatingSource: 'tmdb',
            siteRating: seriesInfo.vote_average,
            siteRatingCount: seriesInfo.vote_count,
            genre: JSON.stringify((seriesInfo.genres ?? []).map(genre => genre.name)),
            runtime: seriesInfo.episode_run_time?.[0] ?? null,
            network: seriesInfo.networks?.[0]?.name ?? null,
            ...(validCreditLists(aggregateCredits) ? { _credits: credits, _preserveCreators: retrievedInfo === undefined } : {})
        };

        let externalIds: { tvdb_id?: number | null; imdb_id?: string | null } = {};

        if (!(series.tvdbid && series.imdbid)) {
            externalIds = await optionalMetadata(() => promiseTimeout(this.oblecto.tmdb.tvExternalIds({ id: series.tmdbid! }, { timeout: 5000 })), `TMDB series ${series.id} external IDs`) ?? {};
        }

        if (!series.tvdbid) {
            data.tvdbid = externalIds.tvdb_id;
        }

        if (!series.imdbid) {
            data.imdbid = externalIds.imdb_id;
        }

        return data;
    }
}
