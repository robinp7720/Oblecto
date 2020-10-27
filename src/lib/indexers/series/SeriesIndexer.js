import AggregateIdentifier from '../../common/AggregateIdentifier';

import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';

import { Series } from '../../../models/series';
import { Episode } from '../../../models/episode';
import IdentificationError from '../../errors/IdentificationError';
import logger from '../../../submodules/logger'
import guessit from '../../../submodules/guessit';

export default class SeriesIndexer {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.seriesIdentifier = new AggregateIdentifier();
        this.episodeIdentifer = new AggregateIdentifier();

        //this.seriesIdentifier.loadIdentifier(new TvdbSeriesIdentifier());
        this.seriesIdentifier.loadIdentifier(new TmdbSeriesIdentifier(this.oblecto));

        //this.episodeIdentifer.loadIdentifier(new TvdbEpisodeIdentifier());
        this.episodeIdentifer.loadIdentifier(new TmdbEpisodeIdentifier(this.oblecto));

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('indexEpisode', async (job) => await this.indexFile(job.path));
    }

    async indexSeries(file, guessitIdentification) {
        let seriesIdentification;

        try {
            seriesIdentification = await this.seriesIdentifier.identify(file.path, guessitIdentification);
        } catch (e) {
            throw new IdentificationError(`Could not identify series of ${file.path}`)
        }

        logger.log('DEBUG', `${file.path} series identified: ${seriesIdentification.seriesName}`)

        let seriesQuery = {};

        if (seriesIdentification.tvdbid) seriesQuery['tvdbid'] = seriesIdentification.tvdbid;
        if (seriesIdentification.tmdbid) seriesQuery['tmdbid'] = seriesIdentification.tmdbid;

        delete seriesIdentification.tvdbid;
        delete seriesIdentification.tmdbid;

        let [series, seriesCreated] = await Series.findOrCreate(
            {
                where: seriesQuery,
                defaults: seriesIdentification
            });

        if (seriesCreated) {
            this.oblecto.queue.pushJob('updateSeries', series);
            this.oblecto.queue.queueJob('downloadSeriesPoster', series);
        }

        return series;
    }

    async indexFile(episodePath) {
        let file = await this.oblecto.fileIndexer.indexVideoFile(episodePath);

        const guessitIdentification = await guessit.identify(episodePath);

        let series = await this.indexSeries(file, guessitIdentification);

        let episodeIdentification

        try {
            episodeIdentification = await this.episodeIdentifer.identify(episodePath, guessitIdentification, series);
        } catch (e) {
            throw new IdentificationError(`Could not identify episode ${episodePath}`)
        }

        logger.log('DEBUG', `${file.path} episode identified ${episodeIdentification.episodeName}`);

        let episodeQuery = {};

        if (episodeIdentification.tvdbid) episodeQuery['tvdbid'] = episodeIdentification.tvdbid;
        if (episodeIdentification.tmdbid) episodeQuery['tmdbid'] = episodeIdentification.tmdbid;

        delete episodeIdentification.tvdbid;
        delete episodeIdentification.tmdbid;

        let [episode, episodeCreated] = await Episode.findOrCreate(
            {
                where: {
                    ...episodeQuery,
                    airedSeason: episodeIdentification.airedSeason || 1,
                    airedEpisodeNumber: episodeIdentification.airedEpisodeNumber,

                    SeriesId: series.id
                },
                defaults: episodeIdentification,
            });

        await episode.addFile(file);

        if (episodeCreated) {
            this.oblecto.queue.pushJob('updateEpisode', episode);
            this.oblecto.queue.queueJob('downloadEpisodeBanner', episode);
        }
    }

}
