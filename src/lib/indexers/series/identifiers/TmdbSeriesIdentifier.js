import guessit from '../../../../submodules/guessit';
import IdentificationError from '../../../errors/IdentificationError';
import SeriesIdentifer from '../SeriesIdentifer';

export default class TmdbSeriesIdentifier extends SeriesIdentifer {
    constructor(oblecto) {
        super(oblecto);

        this.tvShowCache = {};
    }

    retrieveSeries(tmdbSearch, guessitIdentification) {
        for (let series of tmdbSearch) {
            if (!series.first_air_date) continue;
            if (guessitIdentification.year.toString() !== series.first_air_date.substr(0, 4).toString()) continue;

            return series;
        }

        throw new IdentificationError();
    }

    async identify(path) {
        const guessitIdentification = await guessit.identify(path);

        let cacheId = guessitIdentification.title;

        if (guessitIdentification.year) {
            cacheId += guessitIdentification.year;
        }

        if (this.tvShowCache[cacheId]) {
            return this.tvShowCache[cacheId];
        }

        let tmdbSearch = (await this.oblecto.tmdb.searchTv({query: guessitIdentification.title})).results;

        if (tmdbSearch.length < 1) {
            throw new IdentificationError();
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
