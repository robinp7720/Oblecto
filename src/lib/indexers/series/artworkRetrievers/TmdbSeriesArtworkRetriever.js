import ImageManager from '../../../imageManager';
import request from 'request-promise-native';
import tmdb from '../../../../submodules/tmdb';

export default class TmdbSeriesArtworkRetriever extends ImageManager {
    static async retrieveEpisodeBanner(episode, path) {
        if (await this.imageExists(path)) {
            return;
        }

        let data = await tmdb.tvEpisodeImages({
            id: episode.tvshow.tmdbid,
            episode_number: episode.airedEpisodeNumber,
            season_number: episode.airedSeason
        });


        let image = await request({
            uri: 'https://image.tmdb.org/t/p/original' + data.stills[0]['file_path'],
            encoding: null
        });

        await this.save(path, image);
    }

    static async retrieveSeriesPoster (series, path) {
        if (await this.imageExists(path)) {
            return;
        }

        let data = await tmdb.tvImages({
            id: series.tmdbid
        });

        let image = await request({
            uri: 'https://image.tmdb.org/t/p/original' + data.posters[0]['file_path'],
            encoding: null
        });

        await this.save(path, image);
    }
}
