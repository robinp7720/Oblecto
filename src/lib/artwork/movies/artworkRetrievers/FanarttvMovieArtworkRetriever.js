import DebugExtendableError from '../../../errors/DebugExtendableError';
import axiosTimeout from '../../../../submodules/axiosTimeout';
import InfoExtendableError from '../../../errors/InfoExtendableError';

export default class FanarttvMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.key = this.oblecto.config['fanart.tv'].key;
    }

    /**
     *  Get artwork info from fanarttv
     *
     * @param {number | string} id - TMDB or IMDBID of movie item
     * @returns {Promise<*>} - Artwork lists
     */
    async getArtwork(id) {
        try {
            const { data } = await axiosTimeout({
                method: 'get',
                url: `http://webservice.fanart.tv/v3/movies/${id}?api_key=${this.key}`
            });

            return data;
        } catch (e) {
            throw new InfoExtendableError(`No artwork found for id ${id}`);
        }
    }

    async retrieveFanart(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        const data = await this.getArtwork(movie.tmdbid || movie.imdbid);

        if (!data.moviebackground) return [];

        return data.moviebackground.map(image => image.url);
    }

    async retrievePoster(movie) {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        const data = await this.getArtwork(movie.tmdbid || movie.imdbid);

        if (!data.movieposter) return [];

        return data.movieposter.map(image => image.url);
    }
}
