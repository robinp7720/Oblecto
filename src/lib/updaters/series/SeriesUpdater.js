import AggregateSeriesUpdateRetriever from './AggregateSeriesUpdateRetriever';
import TmdbSeriesRetriever from './informationRetrievers/TmdbSeriesRetriever';
import AggregateEpisodeIdentifier from '../../indexers/series/AggregateEpisodeIdentifier';
import TmdbEpisodeRetriever from './informationRetrievers/TmdbEpisodeRetriever';
import AggregateEpisodeUpdateRetriever from './AggregateEpisodeUpdateRetriever';

export default class SeriesUpdater {

    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateSeriesUpdateRetriever = new AggregateSeriesUpdateRetriever();
        this.aggregateSeriesUpdateRetriever.loadRetriever(new TmdbSeriesRetriever(this.oblecto));

        this.aggregateEpisodeUpdaterRetriever = new AggregateEpisodeUpdateRetriever();
        this.aggregateEpisodeUpdaterRetriever.loadRetriever(new TmdbEpisodeRetriever(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('updateEpisode', async (job) => {
            await this.updateEpisode(job);
        });

        this.oblecto.queue.addJob('updateSeries', async (job) => {
            await this.updateSeries(job);
        });
    }

    async updateSeries(series) {
        let data = await this.aggregateSeriesUpdateRetriever.retrieveSeriesInformation(series);
        await series.update(data);
    }

    async updateEpisode(episode) {
        let data = await this.aggregateEpisodeUpdaterRetriever.retrieveEpisodeInformation(episode);
        await episode.update(data);
    }
}
