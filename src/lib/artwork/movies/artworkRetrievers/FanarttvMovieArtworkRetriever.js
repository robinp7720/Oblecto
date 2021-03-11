import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';

export default class FanarttvMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.key = this.oblecto.config['fanart.tv'].key;
    }

    async retrieveFanart(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        const { data } = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/movies/${movie.tmdbid || movie.imdbid}?api_key=${this.key}`
        });

        if (!data.moviebackground) return [];

        return data.moviebackground.map(image => image.url);
    }

    async retrievePoster(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        const { data } = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/movies/${movie.tmdbid || movie.imdbid}?api_key=${this.key}`
        });

        if (!data.movieposter) return [];

        return data.movieposter.map(image => image.url);
    }
}
