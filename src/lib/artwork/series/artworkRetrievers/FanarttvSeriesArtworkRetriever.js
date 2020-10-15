import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';

export default class FanarttvSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveSeriesPoster(series) {
        if (!(series.tvdbid)) throw new DebugExtendableError(`No tvdb id found for movie ${series.seriesName}`);

        let {data} = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/tv/${series.tvdbid}?api_key=${this.oblecto.config['fanart.tv'].key}`
        });

        return data.tvposter[0].url;
    }
}
