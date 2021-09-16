import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';

import { Episode } from '../../../../models/episode';
import { Series } from '../../../../models/series';

export default class FanarttvSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Episode} episode - Episode for which to retrieve banner URLs for
     * @returns {Promise<string[]>} - Array of poster urls
     */
    async retrieveEpisodeBanner(episode) {
        return [];
    }

    /**
     *
     * @param {Series} series - Series for which to retrieve a poster for
     * @returns {Promise<string[]>} - Array of banner urls
     */
    async retrieveSeriesPoster(series) {
        if (!series.tvdbid) throw new DebugExtendableError(`Fanart.tv Series poster retriever failed for ${series.seriesName}`);

        let { data } = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/tv/${series.tvdbid}?api_key=${this.oblecto.config['fanart.tv'].key}`
        });

        return data.tvposter.map(image => image.url);
    }
}
