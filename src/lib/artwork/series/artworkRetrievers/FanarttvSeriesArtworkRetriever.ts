import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import axiosTimeout from '../../../../submodules/axiosTimeout.js';

import { Episode } from '../../../../models/episode.js';
import { Series } from '../../../../models/series.js';
import InfoExtendableError from '../../../errors/InfoExtendableError.js';

import type Oblecto from '../../../oblecto/index.js';

type FanartResponse = {
    tvposter?: Array<{ url: string }>;
};

export default class FanarttvSeriesArtworkRetriever {
    public oblecto: Oblecto;
    public key: string;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.key = this.oblecto.config['fanart.tv'].key;
    }

    /**
     *  Get artwork info from fanarttv
     * @param id - tvdbid of series item
     * @returns - Artwork lists
     */
    async getArtwork(id: number | string): Promise<FanartResponse> {
        try {
            const { data } = await axiosTimeout({
                method: 'get',
                url: `http://webservice.fanart.tv/v3/tv/${id}?api_key=${this.key}`
            });

            return data as FanartResponse;
        } catch (_) {
            throw new InfoExtendableError(`No artwork found for id ${id}`);
        }
    }

    /**
     *
     * @param episode - Episode for which to retrieve banner URLs for
     * @returns - Array of poster urls
     */
    retrieveEpisodeBanner(episode: Episode): Promise<string[]> {
        void episode;
        return Promise.resolve([]);
    }

    /**
     *
     * @param series - Series for which to retrieve a poster for
     * @returns - Array of banner urls
     */
    async retrieveSeriesPoster(series: Series): Promise<string[]> {
        if (series.tvdbid === null || series.tvdbid === undefined) throw new DebugExtendableError(`No TVDBID for ${series.seriesName}`);

        const { tvposter } = await this.getArtwork(series.tvdbid);

        if (!tvposter) throw new DebugExtendableError(`No TVPoster available for ${series.seriesName}`);

        return tvposter.map(image => image.url);
    }
}
