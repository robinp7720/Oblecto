import IdentificationError from '../../../errors/IdentificationError';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import SeriesIdentifier from '../SeriesIdentifer';
import { distance } from 'fastest-levenshtein';

/**
 * @typedef {import('../../../oblecto').default} Oblecto
 */

export default class TvdbSeriesIdentifier extends SeriesIdentifier {
    /**
     * @param {Oblecto} oblecto - Oblecto instance
     */
    constructor(oblecto) {
        super(oblecto);

        this.tvShowCache = {};
    }

    findMatch(found, guessitId) {
        let title = guessitId.title;

        if (Array.isArray(title)) {
            title = title.join(' ');
        }

        // We need to do this as TVDB search ordering is pretty terrible
        // When the tvdb identifier attempts to index "Doctor Who", it will identify it as "Doctor Who Confidential"
        // if we use the first search result. Finding for the closest named match seems like the best solution
        let shortestDistance = -1;
        let shortestItem;

        for (let item of found) {
            let currentDistance = distance(title, item.seriesName);

            if (shortestDistance === -1 || currentDistance < shortestDistance) {
                shortestDistance = currentDistance;
                shortestItem = item;
            }
        }

        return shortestItem;
    }

    async searchSeries(guessitIdentification) {
        let title = guessitIdentification.title;

        if (Array.isArray(title)) {
            title = title.join(' ');
        }

        let tvdbSearch = await promiseTimeout(this.oblecto.tvdb.getSeriesByName(title));

        if (!guessitIdentification.year) return this.findMatch(tvdbSearch, guessitIdentification);

        let candidates = [];

        for (let series of tvdbSearch) {
            if (!series.firstAired) continue;
            if (guessitIdentification.year.toString() !== series.firstAired.substr(0, 4)) continue;

            candidates.push(series);
        }

        if (candidates.length === 0) throw new IdentificationError();

        return this.findMatch(candidates, guessitIdentification);
    }

    async identify(path, guessitIdentification) {
        let title = guessitIdentification.title;

        if (Array.isArray(title)) {
            title = title.join(' ');
        }

        if (guessitIdentification.year) {
            title += guessitIdentification.year;
        }

        if (this.tvShowCache[title]) {
            return this.tvShowCache[title];
        }

        let series = await this.searchSeries(guessitIdentification);

        this.tvShowCache[title] = {
            tvdbid: series.id,
            seriesName: series.seriesName,
            overview: series.overview
        };

        return this.tvShowCache[title];
    }
}
