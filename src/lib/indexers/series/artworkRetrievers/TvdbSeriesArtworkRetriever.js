import ImageManager from '../../../ImageManager';
import request from 'request-promise-native';
import tvdb from '../../../../submodules/tvdb';

export default class TvdbSeriesArtworkRetriever extends ImageManager {
    static async retrieveEpisodeBanner (episode, path) {
        if (await this.imageExists(path)) {
            return;
        }

        let data = await tvdb.getEpisodeById(episode.tvdbid);

        let image = await request({
            uri: 'https://thetvdb.com/banners/_cache/' + data.filename,
            encoding: null
        });

        await this.save(path, image);
    }

    static async retrieveSeriesPoster (series, path) {
        if (await this.imageExists(path)) {
            return;
        }

        let data = await tvdb.getSeriesPosters(series.tvdbid);

        let image = await request({
            uri: 'http://thetvdb.com/banners/' + data[0].fileName,
            encoding: null
        });

        await this.save(path, image);
    }
}
