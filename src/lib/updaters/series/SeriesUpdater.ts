import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever.js';

import TmdbSeriesRetriever from './informationRetrievers/TmdbSeriesRetriever.js';
import TmdbEpisodeRetriever from './informationRetrievers/TmdbEpisodeRetriever.js';
import TvdbEpisodeRetriever from './informationRetrievers/TvdbEpisodeRetriever.js';
import TvdbSeriesRetriever from './informationRetrievers/TvdbSeriesRetriever.js';

import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';

import logger from '../../../submodules/logger/index.js';

import type Oblecto from '../../oblecto/index.js';
import { syncCredits, type RetrievedCredit } from '../common/CreditSync.js';

type UpdaterConstructor = new (oblecto: Oblecto) => {
    // Method syntax on purpose: each retriever narrows the entity it accepts.
    retrieveInformation(entity: unknown): Promise<Record<string, unknown>>;
};

export default class SeriesUpdater {
    public oblecto: Oblecto;
    public aggregateSeriesUpdateRetriever: AggregateUpdateRetriever;
    public aggregateEpisodeUpdaterRetriever: AggregateUpdateRetriever;
    public availableSeriesUpdaters: string[];
    public availableEpisodeUpdaters: string[];

    /**
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.aggregateSeriesUpdateRetriever = new AggregateUpdateRetriever();
        this.aggregateEpisodeUpdaterRetriever = new AggregateUpdateRetriever();

        const seriesUpdateRetrievers: Record<string, UpdaterConstructor> = {
            'tmdb': TmdbSeriesRetriever,
            'tvdb': TvdbSeriesRetriever
        };

        const episodeUpdateRetrievers: Record<string, UpdaterConstructor> = {
            'tmdb': TmdbEpisodeRetriever,
            'tvdb': TvdbEpisodeRetriever
        };

        this.availableSeriesUpdaters = Object.keys(seriesUpdateRetrievers);
        this.availableEpisodeUpdaters = Object.keys(episodeUpdateRetrievers);

        for (const updater of this.oblecto.config.tvshows.seriesUpdaters) {
            logger.debug( `Loading ${updater} series updater`);
            this.aggregateSeriesUpdateRetriever.loadRetriever(new seriesUpdateRetrievers[updater](this.oblecto));
        }

        for (const updater of this.oblecto.config.tvshows.episodeUpdaters) {
            logger.debug( `Loading ${updater} episode updater`);
            this.aggregateEpisodeUpdaterRetriever.loadRetriever(new episodeUpdateRetrievers[updater](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('updateEpisode', async (job: Episode) => {
            await this.updateEpisode(job);
        });

        this.oblecto.queue.registerJob('updateSeries', async (job: Series) => {
            await this.updateSeries(job);
        });
    }

    /**
     *
     * @param series - Series to fetch updated metadata for
     */
    async updateSeries(series: Series): Promise<void> {
        const { id: _ignoredId, ...data } = await this.aggregateSeriesUpdateRetriever.retrieveInformation(series);
        const credits = data._credits as RetrievedCredit[] | undefined;
        delete data._credits;

        const preserveCreators = data._preserveCreators === true;
        delete data._preserveCreators;
        await series.update(data);
        if (credits) await syncCredits('series', series.id, credits, preserveCreators);
        this.oblecto.realTimeController?.broadcast('indexer', {
            event: 'updated', type: 'series', id: series.id
        });
    }

    /**
     *
     * @param episode - Episode to fetch updated metadata for
     */
    async updateEpisode(episode: Episode): Promise<void> {
        const { id: _ignoredId, ...data } = await this.aggregateEpisodeUpdaterRetriever.retrieveInformation(episode);
        const credits = data._credits as RetrievedCredit[] | undefined;
        delete data._credits;

        await episode.update(data);
        if (credits) await syncCredits('episode', episode.id, credits);
        this.oblecto.realTimeController?.broadcast('indexer', {
            event: 'updated', type: 'episode', id: episode.id
        });
    }
}
