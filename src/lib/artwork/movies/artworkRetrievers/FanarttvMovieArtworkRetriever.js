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

        return data.moviebackground[0].url;
    }

    async retrievePoster(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        let {data} = await axiosTimeout({
            method: 'get',
            url: `http://webservice.fanart.tv/v3/movies/${movie.tmdbid || movie.imdbid}?api_key=${this.oblecto.config['fanart.tv'].key}`
        });

        return data.movieposter[0].url;
    }
}
