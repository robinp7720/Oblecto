import DebugExtendableError from '../../../errors/DebugExtendableError';
import promiseTimeout from '../../../../submodules/promiseTimeout';

import { Episode } from '../../../../models/episode';
import { Series } from '../../../../models/series';

import Oblecto from '../../../oblecto';

export default class TvdbSeriesArtworkRetriever {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Episode} episode - Episode for which to retrieve banner URLs for
     * @returns {Promise<string>} - Array of poster urls
     */
    async retrieveEpisodeBanner(episode) {
        if (!episode.tvdbid) throw new DebugExtendableError(`TVDB Episode banner retriever failed for ${episode.episodeName}`);

        let data = await promiseTimeout(this.oblecto.tvdb.getEpisodeById(episode.tvdbid));

        return [`https://thetvdb.com/banners/_cache/${data.filename}`];
    }

    /**
     *
     * @param {Series} series - Series for which to retrieve a poster for
     * @returns {Promise<string>} - Array of banner urls
     */
    async retrieveSeriesPoster(series) {
        if (!series.tvdbid) throw new DebugExtendableError(`TVDB Series poster retriever failed for ${series.seriesName}`);

        let data = await promiseTimeout(this.oblecto.tvdb.getSeriesPosters(series.tvdbid));

        return data.map(image => `http://thetvdb.com/banners/${image.fileName}`);
    }
}
