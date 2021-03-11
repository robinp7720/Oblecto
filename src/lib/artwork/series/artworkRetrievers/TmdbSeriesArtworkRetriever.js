import DebugExtendableError from '../../../errors/DebugExtendableError';
import promiseTimeout from '../../../../submodules/promiseTimeout';

import { Episode } from '../../../../models/episode';
import { Series } from '../../../../models/series';

export default class TmdbSeriesArtworkRetriever {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Episode} episode - Episode for which to retrieve banner URLs for
     * @returns {Promise<string>} - Array of poster urls
     */
    async retrieveEpisodeBanner(episode) {
        if (!episode.tmdbid) throw new DebugExtendableError(`TMDB Episode banner retriever failed for ${episode.episodeName}`);

        let series = await episode.getSeries();

        let data = await promiseTimeout(this.oblecto.tmdb.episodeImages({
            id: series.tmdbid,
            episode_number: episode.airedEpisodeNumber,
            season_number: episode.airedSeason
        }));

        return data.stills.map(image => `https://image.tmdb.org/t/p/original${image['file_path']}`);
    }

    /**
     *
     * @param {Series} series - Series for which to retrieve a poster for
     * @returns {Promise<string>} - Array of banner urls
     */
    async retrieveSeriesPoster(series) {
        if (!series.tmdbid) throw new DebugExtendableError(`TMDB Series poster retriever failed for ${series.seriesName}`);

        let data = await promiseTimeout(this.oblecto.tmdb.tvImages({
            id: series.tmdbid
        }));

        return data.posters.map(image => `https://image.tmdb.org/t/p/original${image['file_path']}`);
    }
}
