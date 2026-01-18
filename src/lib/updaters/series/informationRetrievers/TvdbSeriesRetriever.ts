import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Series } from '../../../../models/series.js';
import type Oblecto from '../../../oblecto/index.js';

type SeriesWithTvdb = Series & {
    tvdbid: number | null;
};

export default class TvdbSeriesRetriever {
    public oblecto: Oblecto;

    /**
     * @param oblecto - Oblecto server Instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Get metadata for a series from TVDB
     * @param series - Series for which to fetch metadata
     * @returns - Updated series information
     */
    async retrieveInformation(series: SeriesWithTvdb): Promise<Record<string, unknown>> {
        if (!series.tvdbid) throw new DebugExtendableError('No tvdbid attached to series');

        const seriesInfo = await promiseTimeout(this.oblecto.tvdb.getSeriesById(series.tvdbid));

        // TODO: TMDB Voting should be separated from TVDB voting

        return {
            seriesName: seriesInfo.seriesName,
            status: seriesInfo.status,
            firstAired: seriesInfo.firstAired,
            overview: seriesInfo.overview,
            siteRating: seriesInfo.siteRating,
            siteRatingCount: seriesInfo.siteRatingCount,
            rating: seriesInfo.rating,
            airsDayOfWeek: seriesInfo.airsDayOfWeek,
            airsTime: seriesInfo.airsTime,
            network: seriesInfo.network,
            imdbid: seriesInfo.imdbId || null,
            zap2itId: seriesInfo.zap2itId || null
        };
    }
}
