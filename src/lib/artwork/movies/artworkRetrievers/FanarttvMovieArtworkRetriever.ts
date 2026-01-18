import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import axiosTimeout from '../../../../submodules/axiosTimeout.js';
import InfoExtendableError from '../../../errors/InfoExtendableError.js';

import type Oblecto from '../../../oblecto/index.js';
import type { Movie } from '../../../../models/movie.js';

type FanartMovieResponse = {
    moviebackground?: Array<{ url: string }>;
    movieposter?: Array<{ url: string }>;
};

export default class FanarttvMovieArtworkRetriever {
    public oblecto: Oblecto;
    public key: string;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.key = this.oblecto.config['fanart.tv'].key;
    }

    /**
     *  Get artwork info from fanarttv
     * @param id - TMDB or IMDBID of movie item
     * @returns - Artwork lists
     */
    async getArtwork(id: number | string): Promise<FanartMovieResponse> {
        try {
            const { data } = await axiosTimeout({
                method: 'get',
                url: `http://webservice.fanart.tv/v3/movies/${id}?api_key=${this.key}`
            });

            return data as FanartMovieResponse;
        } catch (e) {
            throw new InfoExtendableError(`No artwork found for id ${id}`);
        }
    }

    async retrieveFanart(movie: Movie): Promise<string[]> {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        const data = await this.getArtwork(movie.tmdbid || movie.imdbid);

        if (!data.moviebackground) return [];

        return data.moviebackground.map(image => image.url);
    }

    async retrievePoster(movie: Movie): Promise<string[]> {
        if (!(movie.tmdbid || movie.imdbid)) throw new DebugExtendableError(`No tmdbid or imdb id found for movie ${movie.movieName}`);

        const data = await this.getArtwork(movie.tmdbid || movie.imdbid);

        if (!data.movieposter) return [];

        return data.movieposter.map(image => image.url);
    }
}
