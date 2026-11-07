import DebugExtendableError from '../../../errors/DebugExtendableError.js';
import type { TvdbEpisode } from '../../../common/tvdbTypes.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';

import { Episode } from '../../../../models/episode.js';
import { Series } from '../../../../models/series.js';

import type { Dependencies } from '../../../contracts.js';

type ServiceDependencies = Dependencies<'tvdb', never>;

export default class TvdbSeriesArtworkRetriever {
    public oblecto: ServiceDependencies;

    /**
     *
     * @param oblecto - Required services and configuration
     */
    constructor(oblecto: ServiceDependencies) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param episode - Episode for which to retrieve banner URLs for
     * @returns - Array of poster urls
     */
    async retrieveEpisodeBanner(episode: Episode): Promise<string[]> {
        if (episode.tvdbid === null || episode.tvdbid === undefined) throw new DebugExtendableError(`TVDB Episode banner retriever failed for ${episode.episodeName}`);

        const data = await promiseTimeout<TvdbEpisode>((this.oblecto.tvdb).getEpisodeById(episode.tvdbid));

        if (!data.filename) throw new DebugExtendableError(`TVDB has no banner for ${episode.episodeName}`);

        return [`https://thetvdb.com/banners/_cache/${data.filename}`];
    }

    /**
     *
     * @param series - Series for which to retrieve a poster for
     * @returns - Array of banner urls
     */
    async retrieveSeriesPoster(series: Series): Promise<string[]> {
        if (series.tvdbid === null || series.tvdbid === undefined) throw new DebugExtendableError(`TVDB Series poster retriever failed for ${series.seriesName}`);

        const data = await promiseTimeout((this.oblecto.tvdb).getSeriesPosters(series.tvdbid));

        return (data as { fileName: string }[]).map((image) => `http://thetvdb.com/banners/${image.fileName}`);
    }
}
