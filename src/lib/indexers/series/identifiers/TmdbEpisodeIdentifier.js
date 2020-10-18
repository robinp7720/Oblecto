import guessit from '../../../../submodules/guessit';
import IdentificationError from '../../../errors/IdentificationError';
import EpisodeIdentifier from '../EpisodeIdentifier';
import promiseTimeout from '../../../../submodules/promiseTimeout';

export default class TmdbEpisodeIdentifier extends EpisodeIdentifier {
    async identify(path, guessitIdentification, series) {
        if (!series.tmdbid) throw new IdentificationError();

        let episode = await promiseTimeout(this.oblecto.tmdb.episodeInfo({
            id: series.tmdbid,
            season_number: guessitIdentification.season || 1,
            episode_number: guessitIdentification.episode
        }));

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
