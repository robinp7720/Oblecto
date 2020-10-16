import DebugExtendableError from '../../../errors/DebugExtendableError';

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

        let data = await this.oblecto.tvdb.getEpisodeById(episode.tvdbid);

        return `https://thetvdb.com/banners/_cache/${data.filename}`;
    }

    /**
     *
     * @param {Series} series
     * @returns {Promise<string>}
     */
    async retrieveSeriesPoster(series) {
        if (!series.tvdbid) throw new DebugExtendableError(`TVDB Series poster retriever failed for ${series.seriesName}`);

        let data = await this.oblecto.tvdb.getSeriesPosters(series.tvdbid);

        return `http://thetvdb.com/banners/${data[0].fileName}`;
    }
}
