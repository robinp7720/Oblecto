import type Oblecto from '../oblecto/index.js';
import type { Episode } from '../../models/episode.js';
import type { Series } from '../../models/series.js';
import type { Movie } from '../../models/movie.js';

export default class ArtworkUtils {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    episodeBannerPath(episode: Episode, size?: string): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if (size !== undefined && size !== '' && (this.oblecto.config.artwork.banner as any)[size] !== undefined)
            return `${this.oblecto.config.assets.episodeBannerLocation}/${size}/${episode.id}.jpg`;
        return `${this.oblecto.config.assets.episodeBannerLocation}/original/${episode.id}.jpg`;
    }

    seriesPosterPath(series: Series, size?: string): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if (size !== undefined && size !== '' && (this.oblecto.config.artwork.poster as any)[size] !== undefined)
            return `${this.oblecto.config.assets.showPosterLocation}/${size}/${series.id}.jpg`;
        return `${this.oblecto.config.assets.showPosterLocation}/original/${series.id}.jpg`;
    }

    moviePosterPath(movie: Movie, size?: string): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if (size !== undefined && size !== '' && (this.oblecto.config.artwork.poster as any)[size] !== undefined)
            return `${this.oblecto.config.assets.moviePosterLocation}/${size}/${movie.id}.jpg`;
        return `${this.oblecto.config.assets.moviePosterLocation}/original/${movie.id}.jpg`;
    }

    movieFanartPath(movie: Movie, size?: string): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if (size !== undefined && size !== '' && (this.oblecto.config.artwork.fanart as any)[size] !== undefined)
            return `${this.oblecto.config.assets.movieFanartLocation}/${size}/${movie.id}.jpg`;
        return `${this.oblecto.config.assets.movieFanartLocation}/original/${movie.id}.jpg`;
    }
}
