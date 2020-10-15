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

        return `https://image.tmdb.org/t/p/original${data.backdrops[0]['file_path']}`;
    }

    async retrievePoster(movie) {
        if (!movie.tmdbid) throw new DebugExtendableError(`No tmdbid id found for movie ${movie.movieName}`);

        let data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        return `https://image.tmdb.org/t/p/original${data.posters[0]['file_path']}`;
    }
}
