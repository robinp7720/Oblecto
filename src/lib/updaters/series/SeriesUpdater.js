import AggregateSeriesUpdateRetriever from './AggregateSeriesUpdateRetriever';
import TmdbSeriesRetriever from './informationRetrievers/TmdbSeriesRetriever';
import AggregateEpisodeIdentifier from '../../indexers/series/AggregateEpisodeIdentifier';
import TmdbEpisodeRetriever from './informationRetrievers/TmdbEpisodeRetriever';
import AggregateEpisodeUpdateRetriever from './AggregateEpisodeUpdateRetriever';

export default class SeriesUpdater {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.aggregateSeriesUpdateRetriever = new AggregateSeriesUpdateRetriever();
        this.aggregateSeriesUpdateRetriever.loadRetriever(new TmdbSeriesRetriever());

        this.aggregateEpisodeUpdaterRetriever = new AggregateEpisodeUpdateRetriever();
        this.aggregateEpisodeUpdaterRetriever.loadRetriever(new TmdbEpisodeRetriever());
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
