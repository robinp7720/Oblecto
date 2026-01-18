import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';

import { Episode } from '../../../../models/episode.js';
import { Series } from '../../../../models/series.js';

import type Oblecto from '../../../oblecto/index.js';

type TvdbEpisodeInfo = {
    filename?: string;
};

type TvdbPosterInfo = {
    fileName: string;
};

export default class TvdbSeriesArtworkRetriever {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param episode - Episode for which to retrieve banner URLs for
     * @returns - Array of poster urls
     */
    async retrieveEpisodeBanner(episode: Episode): Promise<string[]> {
        if (!episode.tvdbid) throw new DebugExtendableError(`TVDB Episode banner retriever failed for ${episode.episodeName}`);

        const data = await promiseTimeout(this.oblecto.tvdb.getEpisodeById(episode.tvdbid)) as TvdbEpisodeInfo;

        return [`https://thetvdb.com/banners/_cache/${data.filename}`];
    }

    /**
     *
     * @param series - Series for which to retrieve a poster for
     * @returns - Array of banner urls
     */
    async retrieveSeriesPoster(series: Series): Promise<string[]> {
        if (!series.tvdbid) throw new DebugExtendableError(`TVDB Series poster retriever failed for ${series.seriesName}`);

        const data = await promiseTimeout(this.oblecto.tvdb.getSeriesPosters(series.tvdbid)) as TvdbPosterInfo[];

        return data.map(image => `http://thetvdb.com/banners/${image.fileName}`);
    }
}
