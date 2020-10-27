import DebugExtendableError from '../../../errors/DebugExtendableError';

export default class TmdbMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveFanart(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        let data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        let urls = [];

        for (let image of data.backdrops) {
            urls.push(`https://image.tmdb.org/t/p/original${image['file_path']}`);
        }

        return urls;
    }

    async retrievePoster(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        let data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        let urls = [];

        for (let image of data.posters) {
            urls.push(`https://image.tmdb.org/t/p/original${image['file_path']}`);
        }

        return urls;
    }
}
