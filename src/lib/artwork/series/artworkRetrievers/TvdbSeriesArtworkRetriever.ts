import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';

import { Episode } from '../../../../models/episode.js';
import { Series } from '../../../../models/series.js';

import type Oblecto from '../../../oblecto/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

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
        if (episode.tvdbid === null || episode.tvdbid === undefined) throw new DebugExtendableError(`TVDB Episode banner retriever failed for ${episode.episodeName}`);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const data = await promiseTimeout((this.oblecto.tvdb).getEpisodeById(episode.tvdbid));
         
        return [`https://thetvdb.com/banners/_cache/${data.filename}`];
    }

    /**
     *
     * @param series - Series for which to retrieve a poster for
     * @returns - Array of banner urls
     */
    async retrieveSeriesPoster(series: Series): Promise<string[]> {
        if (series.tvdbid === null || series.tvdbid === undefined) throw new DebugExtendableError(`TVDB Series poster retriever failed for ${series.seriesName}`);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const data = await promiseTimeout((this.oblecto.tvdb).getSeriesPosters(series.tvdbid));

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return data.map((image: any) => `http://thetvdb.com/banners/${image.fileName}`);
    }
}
