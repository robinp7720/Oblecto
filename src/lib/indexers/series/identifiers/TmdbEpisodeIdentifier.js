import guessit from '../../../../submodules/guessit';
import IdentificationError from '../../../errors/IdentificationError';

export default class TmdbEpisodeIdentifier {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.episodeCache = {};
    }

    async identify(path, series) {
        if (!series.tmdbid) throw new IdentificationError();

        const guessitIdentification = await guessit.identify(path);

        let episode = await this.oblecto.tmdb.tvEpisodeInfo({
            id: series.tmdbid,
            season_number: guessitIdentification.season,
            episode_number: guessitIdentification.episode
        });

        return {
            tmdbid: episode.id,

            episodeName: episode.name,
            airedEpisodeNumber: episode.episode_number,
            airedSeason: episode.season_number,

            overview: episode.overview,
            firstAired: episode.air_date
        };

    }
}
