import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import DebugExtendableError from '../../../errors/DebugExtendableError.js';

import type { Series } from '../../../../models/series.js';
import type Oblecto from '../../../oblecto/index.js';

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

        const seriesInfo = await promiseTimeout(this.oblecto.tmdb.tvInfo({ id: series.tmdbid }, { timeout: 5000 }));

        const data: Record<string, unknown> = {
            seriesName: seriesInfo.name,
            status: seriesInfo.status,
            firstAired: seriesInfo.first_air_date,
            overview: seriesInfo.overview,
            popularity: seriesInfo.popularity,
            siteRating: seriesInfo.vote_average,
            siteRatingCount: seriesInfo.vote_count,
            genre: JSON.stringify(seriesInfo.genres.map((i: { name: string }) => i.name))
        };

        let externalIds: { tvdb_id?: number; imdb_id?: string } = {};

        if (!(series.tvdbid && series.imdbid)) {
            externalIds = await promiseTimeout(this.oblecto.tmdb.tvExternalIds({ id: series.tmdbid }, { timeout: 5000 }));
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
