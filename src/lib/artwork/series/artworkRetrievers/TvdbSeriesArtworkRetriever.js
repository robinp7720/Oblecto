import DebugExtendableError from '../../../errors/DebugExtendableError';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TvdbSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Episode} episode
     * @returns {Promise<string>}
     */
    async retrieveEpisodeBanner(episode) {
        if (!episode.tvdbid) throw new DebugExtendableError(`TVDB Episode banner retriever failed for ${episode.episodeName}`);

        let data = await promiseTimeout(this.oblecto.tvdb.getEpisodeById(episode.tvdbid));

        return [`https://thetvdb.com/banners/_cache/${data.filename}`];
    }

    /**
     *
     * @param {Series} series
     * @returns {Promise<string>}
     */
    async retrieveSeriesPoster(series) {
        if (!series.tvdbid) throw new DebugExtendableError(`TVDB Series poster retriever failed for ${series.seriesName}`);

        let data = await promiseTimeout(this.oblecto.tvdb.getSeriesPosters(series.tvdbid));

        let urls = [];

        for (let image of data) {
            urls.push(`http://thetvdb.com/banners/${image.fileName}`);
        }

        return urls;
    }
}
