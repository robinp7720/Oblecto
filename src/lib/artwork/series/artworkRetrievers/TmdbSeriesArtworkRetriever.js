import DebugExtendableError from '../../../errors/DebugExtendableError';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TmdbSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Episode} episode
     * @returns {Promise<string>}
     */
    async retrieveEpisodeBanner(episode) {
        if (!episode.tmdbid) throw new DebugExtendableError(`TMDB Episode banner retriever failed for ${episode.episodeName}`);

        let series = await episode.getSeries();

        let data = await promiseTimeout(this.oblecto.tmdb.episodeImages({
            id: series.tmdbid,
            episode_number: episode.airedEpisodeNumber,
            season_number: episode.airedSeason
        }));

        let urls = [];

        for (let image of data.stills) {
            urls.push(`https://image.tmdb.org/t/p/original${image['file_path']}`);
        }

        return urls;
    }

    /**
     *
     * @param {Series} series
     * @returns {Promise<string>}
     */
    async retrieveSeriesPoster(series) {
        if (!series.tmdbid) throw new DebugExtendableError(`TMDB Series poster retriever failed for ${series.seriesName}`);

        let data = await promiseTimeout(this.oblecto.tmdb.tvImages({
            id: series.tmdbid
        }));

        let urls = [];

        for (let image of data.posters) {
            urls.push(`https://image.tmdb.org/t/p/original${image['file_path']}`);
        }

        return urls;
    }
}
