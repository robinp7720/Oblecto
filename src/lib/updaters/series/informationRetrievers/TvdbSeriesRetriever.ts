import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Series } from '../../../../models/series.js';
import type { Dependencies } from '../../../contracts.js';
import type { TvdbSeries } from '../../../common/tvdbTypes.js';

type ServiceDependencies = Dependencies<'tvdb', never>;

type SeriesWithTvdb = Series & {
    tvdbid: number | null;
};

export default class TvdbSeriesRetriever {
    public oblecto: ServiceDependencies;

    /**
     * @param oblecto - Required services and configuration
     */
    constructor(oblecto: ServiceDependencies) {
        this.oblecto = oblecto;
    }

    /**
     * Get metadata for a series from TVDB
     * @param series - Series for which to fetch metadata
     * @returns - Updated series information
     */
    async retrieveInformation(series: SeriesWithTvdb): Promise<Record<string, unknown>> {
        if (!series.tvdbid) throw new DebugExtendableError('No tvdbid attached to series');

        const seriesInfo = await promiseTimeout<TvdbSeries>(this.oblecto.tvdb.getSeriesById(series.tvdbid));

        // TODO: TMDB Voting should be separated from TVDB voting

        return {
            seriesName: seriesInfo.seriesName,
            status: seriesInfo.status,
            firstAired: seriesInfo.firstAired,
            overview: seriesInfo.overview,
            siteRatingSource: 'tvdb',
            siteRating: seriesInfo.siteRating,
            siteRatingCount: seriesInfo.siteRatingCount,
            rating: seriesInfo.rating,
            airsDayOfWeek: seriesInfo.airsDayOfWeek,
            airsTime: seriesInfo.airsTime,
            network: seriesInfo.network,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            imdbid: seriesInfo.imdbId || null,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            zap2itId: seriesInfo.zap2itId || null
        };
    }
}
