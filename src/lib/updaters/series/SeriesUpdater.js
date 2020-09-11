import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever';

import TmdbSeriesRetriever from './informationRetrievers/TmdbSeriesRetriever';
import TmdbEpisodeRetriever from './informationRetrievers/TmdbEpisodeRetriever';


export default class SeriesUpdater {

    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateSeriesUpdateRetriever = new AggregateUpdateRetriever();
        this.aggregateSeriesUpdateRetriever.loadRetriever(new TmdbSeriesRetriever(this.oblecto));

        this.aggregateEpisodeUpdaterRetriever = new AggregateUpdateRetriever();
        this.aggregateEpisodeUpdaterRetriever.loadRetriever(new TmdbEpisodeRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('updateEpisode', async (job) => {
            await this.updateEpisode(job);
        });

        this.oblecto.queue.addJob('updateSeries', async (job) => {
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
