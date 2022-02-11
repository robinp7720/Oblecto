import {Op} from 'sequelize';

import AggregateIdentifier from '../../common/AggregateIdentifier';

import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier';
import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier';

import {Series} from '../../../models/series';
import {Episode} from '../../../models/episode';
import {File} from '../../../models/file';

import IdentificationError from '../../errors/IdentificationError';
import logger from '../../../submodules/logger';
import guessit from '../../../submodules/guessit';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 * @typedef {import('../../../submodules/guessit').GuessitIdentification} GuessitIdentification
 */

/**
 * Oblecto module to identify and index series and episodes
 */
export default class SeriesIndexer {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
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

    /**
     * Identify and index the series of a given file
     *
     * @param {File} file - File to be indexed
     * @param {GuessitIdentification} guessitIdentification - Guessit identification Object
     * @returns {Promise<Series>} - Matched series
     */
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
            seriesQuery.push({ [identifier]: seriesIdentification[identifier] });
        }

        let [series, seriesCreated] = await Series.findOrCreate(
            {
                where: { [Op.or] : seriesQuery },
                defaults: seriesIdentification
            });

        if (seriesCreated) {
            this.oblecto.queue.pushJob('updateSeries', series);
            this.oblecto.queue.queueJob('downloadSeriesPoster', series);
        }

        return series;
    }

    async identify(episodePath) {
        const guessitIdentification = await guessit.identify(episodePath);
        const seriesIdentification = await this.seriesIdentifier.identify(episodePath, guessitIdentification);
        const episodeIdentification = await this.episodeIdentifer.identify(episodePath, guessitIdentification, seriesIdentification);

        return { ...seriesIdentification, ...episodeIdentification };
    }

    /**
     * Index a specific file and identify it as a series
     *
     * @param {string} episodePath - Path to episode to index
     * @returns {Promise<void>}
     */
    async indexFile(episodePath) {
        let file = await this.oblecto.fileIndexer.indexVideoFile(episodePath);

        /**
         * @type {GuessitIdentification}
         */
        const guessitIdentification = await guessit.identify(episodePath);

        // Some single season shows usually don't have a season in the title,
        // therefore whe should set it to 1 by default.
        if (!guessitIdentification.season) {
            guessitIdentification.season = 1;
        }

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
