import promiseTimeout from '../../../../submodules/promiseTimeout';
import DebugExtendableError from '../../../errors/DebugExtendableError';

export default class TmdbSeriesRetriever {
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
        if (!series.tmdbid) throw new DebugExtendableError('No tmdbid attached to series');

        const seriesInfo = await promiseTimeout(this.oblecto.tmdb.tvInfo({ id: series.tmdbid }, {timeout: 5000}));

        let data = {
            seriesName: seriesInfo.name,
            status: seriesInfo.status,
            firstAired: seriesInfo.first_air_date,
            overview: seriesInfo.overview,
            popularity: seriesInfo.popularity,
            siteRating: seriesInfo.vote_average,
            siteRatingCount: seriesInfo.vote_count,
            genre: JSON.stringify(seriesInfo.genres.map(i => i.name))
        };

        let externalIds = {};

        if (!(series.tvdbid && series.imdbid)) {
            externalIds = await promiseTimeout(this.oblecto.tmdb.tvExternalIds({id: series.tmdbid}, {timeout: 5000}));
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
