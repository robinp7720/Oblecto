import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';

import { Episode } from '../../../../models/episode.js';
import { Series } from '../../../../models/series.js';

import type Oblecto from '../../../oblecto/index.js';

type TmdbImage = { file_path: string };

export default class TmdbSeriesArtworkRetriever {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param episode - Episode for which to retrieve banner URLs for
     * @returns - Array of poster urls
     */
    async retrieveEpisodeBanner(episode: Episode): Promise<string[]> {
        if (!episode.tmdbid) throw new DebugExtendableError(`TMDB Episode banner retriever failed for ${episode.episodeName}`);

        const series = await episode.getSeries();

        const { stills } = await promiseTimeout(this.oblecto.tmdb.episodeImages({
            id: series.tmdbid,
            episode_number: episode.airedEpisodeNumber,
            season_number: episode.airedSeason
        }));

        return (stills as TmdbImage[]).map(image => `https://image.tmdb.org/t/p/original${image.file_path}`);
    }

    /**
     *
     * @param series - Series for which to retrieve a poster for
     * @returns - Array of banner urls
     */
    async retrieveSeriesPoster(series: Series): Promise<string[]> {
        if (!series.tmdbid) throw new DebugExtendableError(`TMDB Series poster retriever failed for ${series.seriesName}`);

        const { posters } = await promiseTimeout(this.oblecto.tmdb.tvImages({ id: series.tmdbid }));

        return (posters as TmdbImage[]).map(image => `https://image.tmdb.org/t/p/original${image.file_path}`);
    }
}
