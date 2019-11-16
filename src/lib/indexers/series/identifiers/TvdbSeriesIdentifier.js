import guessit from '../../../../submodules/guessit';
import tvdb from '../../../../submodules/tvdb';

export default class TvdbSeriesIdentifier {
    constructor() {
        this.tvShowCache = {};
    }

    async tvShowInfo(id) {
        return tvdb.getSeriesById(id);
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

        let tvdbSearch = await tvdb.getSeriesByName(guessitIdentification.title);

        for (let i in tvdbSearch) {
            if (!tvdbSearch.hasOwnProperty(i))
                continue;

            let series = tvdbSearch[i];

            if (
                (
                    guessitIdentification.year &&
                    series.firstAired &&
                    guessitIdentification.year.toString() === series.firstAired.substr(0, 4)
                ) || !(
                    guessitIdentification.year
                )
            ) {
                let currentShowInfo;

                try {
                    currentShowInfo = await this.tvShowInfo(series.id);
                } catch (e) {
                    console.log('An error has occured with the TVDB identifier. We found an id but it seams it doesn\'t exist.');
                    continue;
                }

                this.tvShowCache[cacheId] = {
                    tvdbId: currentShowInfo.id,
                    tvdbSeriedId: currentShowInfo.seriedId,
                    imdbId: currentShowInfo.imdbId,
                    zap2itId: currentShowInfo.zap2itId,

                    seriesName: currentShowInfo.seriesName,
                    status: currentShowInfo.status,
                    firstAired: currentShowInfo.firstAired,
                    networks: [currentShowInfo.network],
                    runtime: currentShowInfo.runtime,
                    genre: currentShowInfo.genre,
                    overview: currentShowInfo.overview,

                    airsDayOfWeek: currentShowInfo.airsDayOfWeek,
                    airsTime: currentShowInfo.airsTime,

                    ageRating: currentShowInfo.rating,

                    alias: currentShowInfo.aliases,

                    tvdb: {
                        siteRating: currentShowInfo.siteRating,
                        siteRatingCount: currentShowInfo.siteRatingCount
                    }
                };

                return this.tvShowCache[cacheId];
            }
        }

        return false;
    }
}
