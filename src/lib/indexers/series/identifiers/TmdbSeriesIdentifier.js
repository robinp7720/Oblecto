import guessit from '../../../../submodules/guessit';
import tmdb from '../../../../submodules/tmdb';

export default class TmdbSeriesIdentifier {
    constructor() {
        this.tvShowCache = {};
    }

    /**
     *
     * @param id: number
     * @returns {Promise<any>}
     */
    async tvShowInfo(id) {
        return await tmdb.tvInfo(id);
    }

    /**
     *
     * @param path: string
     * @returns {Promise<{
     *  airsDayOfWeek: null,
     *  tvdbSeriedId: number,
     *  overview: string,
     *  tmdb: {popularity: number},
     *  tvdbId: null,
     *  imdbId: null,
     *  seriesName: string,
     *  firstAired: string,
     *  runtime: number,
     *  ageRating: null,
     *  networks: array,
     *  tmdbId: number,
     *  zap2itId: null,
     *  airsTime: null,
     *  genre: array,
     *  status: string
     * } | *>}
     */
    async identify(path) {
        const guessitIdentification = await guessit.identify(path);

        let cacheId = guessitIdentification.title;

        if (guessitIdentification.year) {
            cacheId += guessitIdentification.year;
        }

        if (this.tvShowCache[cacheId]) {
            return this.tvShowCache[cacheId];
        }

        let tmdbSearch = (await tmdb.searchTv({query: guessitIdentification.title})).results;

        if (tmdbSearch.length < 1) {
            throw new Error('No TV Show could be matched');
        }

        for (let i in tmdbSearch) {
            if (!tmdbSearch.hasOwnProperty(i))
                continue;

            let series = tmdbSearch[i];

            // If the file name has the first aired year within the title, ignore all series where the year doesn't match
            if (
                guessitIdentification.year &&
                series.firstAired &&
                guessitIdentification.year !== series.first_air_date.substr(0, 4)
            ) {
                continue;
            }

            let currentShowInfo = await this.tvShowInfo(series.id);

            return this.tvShowCache[cacheId] = {
                tmdbId: currentShowInfo.id,
                tvdbId: null,
                tvdbSeriedId: null,
                imdbId: null,
                zap2itId: null,

                seriesName: currentShowInfo.name,
                status: currentShowInfo.status,
                firstAired: currentShowInfo.first_air_date,
                networks: currentShowInfo.networks.map((network) => {return network.name;}),
                runtime: currentShowInfo.episode_run_time[0],
                genre: currentShowInfo.genres.map((genre) => {return genre.name;}),
                overview: currentShowInfo.overview,

                airsDayOfWeek: null,
                airsTime: null,

                ageRating: null,
                tmdb: {
                    popularity: currentShowInfo.popularity
                }
            };
        }

        throw new Error('Could not identify');
    }
}
