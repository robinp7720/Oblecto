import promiseTimeout from '../../../../submodules/promiseTimeout';
import DebugExtendableError from '../../../errors/DebugExtendableError';

export default class TvdbSeriesRetriever {
    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Series} series
     * @returns {Promise<{overview: *, siteRating: *, seriesName: *, firstAired: *, popularity: *, siteRatingCount: *, status: *}>}
     */
    async retrieveInformation(series) {
        if (!series.tvdbid) throw new DebugExtendableError('No tvdbid attached to series');

        let seriesInfo = await promiseTimeout(this.oblecto.tvdb.getSeriesById(series.tvdbid));

        //TODO: TMDB Voting should be separated from TVDB voting

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
