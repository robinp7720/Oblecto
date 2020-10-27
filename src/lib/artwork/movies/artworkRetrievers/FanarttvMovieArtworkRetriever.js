import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';

export default class FanarttvMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveFanart(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        let {data} = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/movies/${movie.tmdbid || movie.imdbid}?api_key=${this.oblecto.config['fanart.tv'].key}`
        });

        if (!data.moviebackground) return [];

        let urls = [];

        for (let image of data.moviebackground) {
            urls.push(image.url);
        }

        return urls;
    }

    async retrievePoster(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        let {data} = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/movies/${movie.tmdbid || movie.imdbid}?api_key=${this.oblecto.config['fanart.tv'].key}`
        });

        if (!data.movieposter) return [];

        let urls = [];

        for (let image of data.movieposter) {
            urls.push(image.url);
        }

        return urls;
    }
}
