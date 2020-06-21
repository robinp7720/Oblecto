export default class ArtworkUtils {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    episodeBannerPath(episode, size) {
        if (size && this.oblecto.config.artwork.banner[size])
            return `${this.oblecto.config.assets.episodeBannerLocation}/${size}/${episode.id}.jpg`;
        return `${this.oblecto.config.assets.episodeBannerLocation}/original/${episode.id}.jpg`;
    }

    seriesPosterPath(series, size) {
        if (size && this.oblecto.config.artwork.poster[size])
            return `${this.oblecto.config.assets.showPosterLocation}/${size}/${series.id}.jpg`;
        return `${this.oblecto.config.assets.showPosterLocation}/original/${series.id}.jpg`;
    }

    moviePosterPath(movie, size) {
        if (size && this.oblecto.config.artwork.poster[size])
            return `${this.oblecto.config.assets.moviePosterLocation}/${size}/${movie.id}.jpg`;
        return `${this.oblecto.config.assets.moviePosterLocation}/original/${movie.id}.jpg`;
    }

    movieFanartPath(movie, size) {
        if (size && this.oblecto.config.artwork.fanart[size])
            return `${this.oblecto.config.assets.movieFanartLocation}/${size}/${movie.id}.jpg`;
        return `${this.oblecto.config.assets.movieFanartLocation}/original/${movie.id}.jpg`;
    }
}
