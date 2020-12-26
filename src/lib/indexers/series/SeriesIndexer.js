import {Op} from 'sequelize';

import AggregateIdentifier from '../../common/AggregateIdentifier';

import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';
import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier';

import { Series } from '../../../models/series';
import { Episode } from '../../../models/episode';
import IdentificationError from '../../errors/IdentificationError';
import logger from '../../../submodules/logger';
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

        const seriesIdentifiers = {
            'tmdb': TmdbSeriesIdentifier,
            'tvdb': TvdbSeriesIdentifier,
        };

        const episodeIdentifiers = {
            'tmdb': TmdbEpisodeIdentifier,
            'tvdb': TvdbEpisodeIdentifier
        };

        for (let identifier of this.oblecto.config.tvshows.seriesIdentifiers) {
            logger.log('DEBUG', `Loading ${identifier} series identifier`);
            this.seriesIdentifier.loadIdentifier(new seriesIdentifiers[identifier](this.oblecto));
        }

        for (let identifier of this.oblecto.config.tvshows.episodeIdentifiers) {
            logger.log('DEBUG', `Loading ${identifier} episode identifier`);
            this.episodeIdentifer.loadIdentifier(new episodeIdentifiers[identifier](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('indexEpisode', async (job) => await this.indexFile(job.path));
    }

    async indexSeries(file, guessitIdentification) {
        let seriesIdentification;

        try {
            seriesIdentification = await this.seriesIdentifier.identify(file.path, guessitIdentification);
        } catch (e) {
            throw new IdentificationError(`Could not identify series of ${file.path}`);
        }

        logger.log('DEBUG', `${file.path} series identified: ${seriesIdentification.seriesName}`);

        const identifiers = ['tvdbid', 'tmdbid'];

        let seriesQuery = [];

        for (let identifier of identifiers) {
            if (!seriesIdentification[identifier]) continue;
            seriesQuery.push({[identifier]: seriesIdentification[identifier]});
        }

        let [series, seriesCreated] = await Series.findOrCreate(
            {
                where: {[Op.or] : seriesQuery},
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

        let episodeIdentification;

        try {
            episodeIdentification = await this.episodeIdentifer.identify(episodePath, guessitIdentification, series);
        } catch (e) {
            throw new IdentificationError(`Could not identify episode ${episodePath}`);
        }

        logger.log('DEBUG', `${file.path} episode identified ${episodeIdentification.episodeName}`);

        let [episode, episodeCreated] = await Episode.findOrCreate(
            {
                where: {
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
