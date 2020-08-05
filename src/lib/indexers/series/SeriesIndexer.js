import AggregateSeriesIdentifier from './AggregateSeriesIdentifier';
import AggregateEpisodeIdentifier from './AggregateEpisodeIdentifier';
import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier';
import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';
import FileIndexer from '../files/FileIndexer';

import Op from 'sequelize';

import databases from '../../../submodules/database';

export default class SeriesIndexer {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.seriesIdentifier = new AggregateSeriesIdentifier(this.oblecto);
        this.episodeIdentifer = new AggregateEpisodeIdentifier(this.oblecto);

        //this.seriesIdentifier.loadIdentifier(new TvdbSeriesIdentifier());
        this.seriesIdentifier.loadIdentifier(new TmdbSeriesIdentifier(this.oblecto));

        //this.episodeIdentifer.loadIdentifier(new TvdbEpisodeIdentifier());
        this.episodeIdentifer.loadIdentifier(new TmdbEpisodeIdentifier(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('indexEpisode', async (job) => await this.indexFile(job.path, job.doReIndex));
    }

    async indexFile(episodePath, doReIndex) {
        console.log('Indexing ' + episodePath);

        let file = await this.oblecto.fileIndexer.indexVideoFile(episodePath);

        let seriesIdentification = await this.seriesIdentifier.identify(episodePath);
        let episodeIdentification = await this.episodeIdentifer.identify(episodePath, seriesIdentification);

        let seriesQuery = {};
        let episodeQuery = {};

        if (seriesIdentification.tvdbid) seriesQuery['tvdbid'] = seriesIdentification.tvdbid;
        if (seriesIdentification.tmdbid) seriesQuery['tmdbid'] = seriesIdentification.tmdbid;

        delete seriesIdentification.tvdbid;
        delete seriesIdentification.tmdbid;

        if (episodeIdentification.tvdbid) episodeQuery['tvdbid'] = episodeIdentification.tvdbid;
        if (episodeIdentification.tmdbid) episodeQuery['tmdbid'] = episodeIdentification.tmdbid;

        delete episodeIdentification.tvdbid;
        delete episodeIdentification.tmdbid;

        let [series, seriesCreated] = await databases.tvshow.findOrCreate(
            {
                where: seriesQuery,
                defaults: seriesIdentification
            });

        let [episode, episodeCreated] = await databases.episode.findOrCreate(
            {
                where: {
                    ...episodeQuery,
                    airedSeason: episodeIdentification.airedSeason || 1,
                    airedEpisodeNumber: episodeIdentification.airedEpisodeNumber,

                    tvshowId: series.id
                },
                defaults: episodeIdentification,
            });

        await episode.addFile(file);

        if (episodeCreated) {
            this.oblecto.queue.pushJob('updateEpisode', episode);
            this.oblecto.queue.pushJob('downloadEpisodeBanner', episode);
        }

        if (seriesCreated) {
            this.oblecto.queue.pushJob('updateSeries', series);
            this.oblecto.queue.pushJob('downloadSeriesPoster', series);
        }


        return `${episodePath} indexed`;
    }

}
