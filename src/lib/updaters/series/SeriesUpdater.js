import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever';

import TmdbSeriesRetriever from './informationRetrievers/TmdbSeriesRetriever';
import TmdbEpisodeRetriever from './informationRetrievers/TmdbEpisodeRetriever';
import TvdbEpisodeRetriever from './informationRetrievers/TvdbEpisodeRetriever';

import logger from '../../../submodules/logger';
import TvdbSeriesRetriever from './informationRetrievers/TvdbSeriesRetriever';


export default class SeriesUpdater {

    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateSeriesUpdateRetriever = new AggregateUpdateRetriever();
        this.aggregateEpisodeUpdaterRetriever = new AggregateUpdateRetriever();

        const seriesUpdateRetrievers = {
            'tmdb': TmdbSeriesRetriever,
            'tvdb': TvdbSeriesRetriever
        };

        const episodeUpdateRetrievers = {
            'tmdb': TmdbEpisodeRetriever,
            'tvdb': TvdbEpisodeRetriever
        };

        for (let updater of this.oblecto.config.tvshows.seriesUpdaters) {
            logger.log('DEBUG', `Loading ${updater} series updater`);
            this.aggregateSeriesUpdateRetriever.loadRetriever(new seriesUpdateRetrievers[updater](this.oblecto));
        }

        for (let updater of this.oblecto.config.tvshows.episodeUpdaters) {
            logger.log('DEBUG', `Loading ${updater} episode updater`);
            this.aggregateEpisodeUpdaterRetriever.loadRetriever(new episodeUpdateRetrievers[updater](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('updateEpisode', async (job) => {
            await this.updateEpisode(job);
        });

        this.oblecto.queue.registerJob('updateSeries', async (job) => {
            await this.updateSeries(job);
        });
    }

    /**
     *
     * @param {Series} series
     * @returns {Promise<void>}
     */
    async updateSeries(series) {
        let data = await this.aggregateSeriesUpdateRetriever.retrieveInformation(series);
        await series.update(data);
    }

    /**
     *
     * @param {Episode} episode
     * @returns {Promise<void>}
     */
    async updateEpisode(episode) {
        let data = await this.aggregateEpisodeUpdaterRetriever.retrieveInformation(episode);
        await episode.update(data);
    }
}
