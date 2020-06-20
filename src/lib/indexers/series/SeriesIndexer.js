import AggregateSeriesIdentifier from './AggregateSeriesIdentifier';
import AggregateEpisodeIdentifier from './AggregateEpisodeIdentifier';
import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier';
import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';
import FileIndexer from '../files/FileIndexer';


import databases from '../../../submodules/database';

export default class SeriesIndexer {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.seriesIdentifier = new AggregateSeriesIdentifier();
        this.episodeIdentifer = new AggregateEpisodeIdentifier();

        //this.seriesIdentifier.loadIdentifier(new TvdbSeriesIdentifier());
        this.seriesIdentifier.loadIdentifier(new TmdbSeriesIdentifier());

        //this.episodeIdentifer.loadIdentifier(new TvdbEpisodeIdentifier());
        this.episodeIdentifer.loadIdentifier(new TmdbEpisodeIdentifier());
    }

    async indexFile(episodePath) {
        let file = await FileIndexer.indexVideoFile(episodePath);

        let seriesIdentification = await this.seriesIdentifier.identify(episodePath);
        let episodeIdentification = await this.episodeIdentifer.identify(episodePath, seriesIdentification);

        let [series, seriesCreated] = await databases.tvshow.findOrCreate(
            {
                where: {
                    tvdbid: seriesIdentification.tvdbid || null,
                    tmdbid: seriesIdentification.tmdbid || null
                },
                defaults: seriesIdentification
            });

        let [episode, episodeCreated] = await databases.episode.findOrCreate(
            {
                where: {
                    tvdbid: episodeIdentification.tvdbid || null,
                    tmdbid: episodeIdentification.tmdbid || null,
                    airedSeason: episodeIdentification.airedSeason || 1,
                    airedEpisodeNumber: episodeIdentification.airedEpisodeNumber,

                    tvshowId: series.id
                },
                defaults: episodeIdentification,
            });

        episode.addFile(file);

        if (episodeCreated)
            this.oblecto.queue.pushJob('downloadEpisodeBanner', episode);
        if (seriesCreated)
            this.oblecto.queue.pushJob('downloadSeriesPoster', series);

        return `${episodePath} indexed`;
    }

}
