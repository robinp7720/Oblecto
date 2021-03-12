import promiseTimeout from '../../../../submodules/promiseTimeout';
import DebugExtendableError from '../../../errors/DebugExtendableError';
import Oblecto from '../../../oblecto';

import { Series } from '../../../../models/series';

export default class TvdbSeriesRetriever {
    /**
     * @param {Oblecto} oblecto - Oblecto server Instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Get metadata for a series from TVDB
     *
     * @param {Series} series - Series for which to fetch metadata
     * @returns {Promise<{overview: *, siteRating: *, seriesName: *, firstAired: *, popularity: *, siteRatingCount: *, status: *}>} - Updated series information
     */
    async retrieveInformation(series) {
        if (!series.tvdbid) throw new DebugExtendableError('No tvdbid attached to series');

        let seriesInfo = await promiseTimeout(this.oblecto.tvdb.getSeriesById(series.tvdbid));

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
