import guessit from '../../../../submodules/guessit';
import tvdb from '../../../../submodules/tvdb';

export default class TvdbSeriesIdentifier {
    constructor () {
        this.tvShowCache = {};
    }

    async TvShowInfo (id) {
        if (this.tvShowCache[id]) {
            return this.tvShowCache[id];
        }

        return this.tvShowCache[id] = tvdb.getSeriesById(id);
    }

    async Identify (path){
        const guessitIdentification = await guessit.identify(path);

        let tvdbSearch = await tvdb.getSeriesByName(guessitIdentification.title);

        for (let i in tvdbSearch) {
            let series = tvdbSearch[i];

            if (
                !(
                    guessitIdentification.year &&
                    series.firstAired &&
                    guessitIdentification.year == series.firstAired.substr(0,4)
                )
            ) {
                continue;
            }

            return await this.TvShowInfo(series.id);

        }
    }
}
