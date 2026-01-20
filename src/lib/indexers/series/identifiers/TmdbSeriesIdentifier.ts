import IdentificationError from '../../../errors/IdentificationError.js';
import SeriesIdentifer, { SeriesIdentification } from '../SeriesIdentifer.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import type { GuessitIdentification } from '../../../../submodules/guessit.js';
import type Oblecto from '../../../oblecto/index.js';

export default class TmdbSeriesIdentifier extends SeriesIdentifer {
    public tvShowCache: Record<string, SeriesIdentification>;

    constructor(oblecto: Oblecto) {
        super(oblecto);

        this.tvShowCache = {};
    }

    /**
     * Find the most relevant series match from a TMDB Search output
     * @param tmdbSearch - Search results object
     * @param guessitIdentification - Guessit identification object
     * @returns - Best result match
     */
    retrieveSeries(tmdbSearch: Array<{ first_air_date?: string }>, guessitIdentification: GuessitIdentification) {
        // If TMDB only found one series that matches, we'll just ignore the date
        // This fixes some releases where the episode release year is included in
        // the file name instead of the first series release year
        if (tmdbSearch.length === 1) return tmdbSearch[0];

        // If more then one possible match was found, use the one where the date is an exact match
        // TODO: We might want to also match to the most similar name
        for (const series of tmdbSearch) {
            if (!series.first_air_date) continue;
            if (guessitIdentification.year!.toString() !== series.first_air_date.substr(0, 4).toString()) continue;

            return series;
        }

        throw new IdentificationError();
    }

    /**
     *  Identify the series of a given file
     * @param path - Path of file to be identified
     * @param guessitIdentification - Guessit identification object
     * @returns - Matched identification object
     */
    async identify(path: string, guessitIdentification: GuessitIdentification): Promise<SeriesIdentification> {
        let title: string | string[] = guessitIdentification.title;

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

        const tmdbSearch = (await promiseTimeout(this.oblecto.tmdb.searchTv({ query: title }, { timeout: 5000 }))).results as Array<{
            id: number;
            name: string;
            overview: string;
            first_air_date?: string;
        }>;

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
