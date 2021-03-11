import DebugExtendableError from '../../../errors/DebugExtendableError';

export default class TmdbMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveFanart(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        return data.backdrops.map(image => `https://image.tmdb.org/t/p/original${image['file_path']}`);
    }

    async retrievePoster(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        const data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        return data.posters.map(image => `https://image.tmdb.org/t/p/original${image['file_path']}`);
    }
}
