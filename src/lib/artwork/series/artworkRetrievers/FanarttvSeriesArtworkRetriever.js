import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class FanarttvSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveEpisodeBanner(episode) {
        return [];
    }

    async retrieveSeriesPoster(series) {
        if (!series.tvdbid) throw new DebugExtendableError(`Fanart.tv Series poster retriever failed for ${series.seriesName}`);

        let {data} = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/tv/${series.tvdbid}?api_key=${this.oblecto.config['fanart.tv'].key}`
        });

        let urls = [];

        for (let poster of data.tvposter) {
            urls.push(poster.url);
        }

        return urls;
    }
}
