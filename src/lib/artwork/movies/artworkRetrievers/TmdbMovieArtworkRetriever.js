export default class TmdbMovieArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async retrieveFanart(movie) {
        let data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        return `https://image.tmdb.org/t/p/original${data.backdrops[0]['file_path']}`;
    }

    async retrievePoster(movie) {
        let data = await this.oblecto.tmdb.movieImages({
            id: movie.tmdbid
        });

        return `https://image.tmdb.org/t/p/original${data.posters[0]['file_path']}`;
    }
}
