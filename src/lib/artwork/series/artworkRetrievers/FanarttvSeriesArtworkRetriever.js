import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';

import { Episode } from '../../../../models/episode';
import { Series } from '../../../../models/series';
import InfoExtendableError from '../../../errors/InfoExtendableError';

export default class FanarttvSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.key = this.oblecto.config['fanart.tv'].key;
    }

    /**
     *  Get artwork info from fanarttv
     *
     * @param {number | string} id - tvdbid of series item
     * @returns {Promise<*>} - Artwork lists
     */
    async getArtwork(id) {
        try {
            const { data } = await axiosTimeout({
                method: 'get',
                url: `http://webservice.fanart.tv/v3/tv/${id}?api_key=${this.key}`
            });

            return data;
        } catch (e) {
            throw new InfoExtendableError(`No artwork found for id ${id}`);
        }
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
        if (!series.tvdbid) throw new DebugExtendableError(`No TVDBID for ${series.seriesName}`);

        const { tvposter } = await this.getArtwork(series.tvdbid);

        if (!tvposter) throw new DebugExtendableError(`No TVPoster available for ${series.seriesName}`);

        return tvposter.map(image => image.url);
    }
}
