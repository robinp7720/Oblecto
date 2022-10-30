import IdentificationError from '../../../errors/IdentificationError';
import SeriesIdentifer from '../SeriesIdentifer';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TmdbSeriesIdentifier extends SeriesIdentifer {
    constructor(oblecto) {
        super(oblecto);

        this.tvShowCache = {};
    }

    /**
     * Find the most relevant series match from a TMDB Search output
     *
     * @param {*} tmdbSearch - Search results object
     * @param {*} guessitIdentification - Guessit identification object
     * @returns {{first_air_date}|*} - Best result match
     */
    retrieveSeries(tmdbSearch, guessitIdentification) {
        // If TMDB only found one series that matches, we'll just ignore the date
        // This fixes some releases where the episode release year is included in
        // the file name instead of the first series release year
        if (tmdbSearch.length === 1) return tmdbSearch[0];

        // If more then one possible match was found, use the one where the date is an exact match
        // TODO: We might want to also match to the most similar name
        for (let series of tmdbSearch) {
            if (!series.first_air_date) continue;
            if (guessitIdentification.year.toString() !== series.first_air_date.substr(0, 4).toString()) continue;

            return series;
        }

        throw new IdentificationError();
    }

    /**
     *  Identify the series of a given file
     *
     * @param {string} path - Path of file to be identified
     * @param {*} guessitIdentification - Guessit identification object
     * @returns {Promise<{overview, tmdbid, seriesName}|*>} - Matched identification object
     */
    async identify(path, guessitIdentification) {
        let title = guessitIdentification.title;

        if (Array.isArray(title)) {
            title = title.join(' ');
        }

        let cacheId = title;

        if (guessitIdentification.year) {
            cacheId += guessitIdentification.year;
        }

        if (this.tvShowCache[cacheId]) {
            return this.tvShowCache[cacheId];
        }

        let tmdbSearch = (await promiseTimeout(this.oblecto.tmdb.searchTv({ query: title }, { timeout: 5000 }))).results;

        if (tmdbSearch.length < 1) {
            throw new IdentificationError('Search result from TMDB returned empty');
        }

        let series = tmdbSearch[0];

        if (guessitIdentification.year) {
            series = this.retrieveSeries(tmdbSearch, guessitIdentification);
        }

        return this.tvShowCache[cacheId] = {
            tmdbid: series.id,
            seriesName: series.name,
            overview: series.overview
        };
    }
}
