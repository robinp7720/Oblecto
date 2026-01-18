import { distance } from 'fastest-levenshtein';

import IdentificationError from '../../../errors/IdentificationError.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';
import SeriesIdentifier, { SeriesIdentification } from '../SeriesIdentifer.js';
import type { GuessitIdentification } from '../../../../submodules/guessit.js';
import type Oblecto from '../../../oblecto/index.js';

export default class TvdbSeriesIdentifier extends SeriesIdentifier {
    public tvShowCache: Record<string, SeriesIdentification>;
    /**
     * @param {Oblecto} oblecto - Oblecto instance
     */
    constructor(oblecto: Oblecto) {
        super(oblecto);

        this.tvShowCache = {};
    }

    findMatch(found: Array<{ seriesName: string }>, guessitId: GuessitIdentification) {
        let title: string | string[] = guessitId.title;

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

    async searchSeries(guessitIdentification: GuessitIdentification) {
        let title: string | string[] = guessitIdentification.title;

        if (Array.isArray(title)) {
            title = title.join(' ');
        }

        let tvdbSearch = await promiseTimeout(this.oblecto.tvdb.getSeriesByName(title)) as Array<{
            id: number;
            seriesName: string;
            overview?: string;
            firstAired?: string;
        }>;

        if (!guessitIdentification.year) return this.findMatch(tvdbSearch, guessitIdentification);

        let candidates: Array<{ id: number; seriesName: string; overview?: string; firstAired?: string }> = [];

        for (let series of tvdbSearch) {
            if (!series.firstAired) continue;
            if (guessitIdentification.year.toString() !== series.firstAired.substr(0, 4)) continue;

            candidates.push(series);
        }

        if (candidates.length === 0) throw new IdentificationError(`No series found matching "${title}" with year ${guessitIdentification.year}`);

        return this.findMatch(candidates, guessitIdentification);
    }

    async identify(path: string, guessitIdentification: GuessitIdentification): Promise<SeriesIdentification> {
        let title: string | string[] = guessitIdentification.title;

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
