import guessit from '../../../../submodules/guessit';
import IdentificationError from '../../../errors/IdentificationError';

export default class TvdbSeriesIdentifier {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.tvShowCache = {};
    }

    async tvShowInfo(id) {
        return tvdb.getSeriesById(id);
    }

    retrieveSeries(tvdbSearch, guessitIdentification) {
        for (let series of tvdbSearch) {
            if (!series.firstAired) continue;
            if (guessitIdentification.year.toString() !== series.firstAired.substr(0, 4)) continue;

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

        let tvdbSearch = await this.oblecto.tvdb.getSeriesByName(guessitIdentification.title);

        let series = tvdbSearch[0];

        if (guessitIdentification.year) {
            series = this.retrieveSeries(tvdbSearch, guessitIdentification);
        }

        return this.tvShowCache[cacheId] = {
            tvdbid: series.id,
            seriesName: series.seriesName,
            overview: series.overview
        };
    }
}
