import { Op } from 'sequelize';
import path from 'path';

import AggregateIdentifier from '../../common/AggregateIdentifier.js';
import TmdbSeriesIdentifier from './identifiers/TmdbSeriesIdentifier.js';
import TmdbEpisodeIdentifier from './identifiers/TmdbEpisodeIdentifier.js';
import TvdbSeriesIdentifier from './identifiers/TvdbSeriesIdentifier.js';
import TvdbEpisodeIdentifier from './identifiers/TvdbEpisodeIdentifier.js';

import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { File } from '../../../models/file.js';

import IdentificationError from '../../errors/IdentificationError.js';
import logger from '../../../submodules/logger/index.js';
import guessit, { GuessitIdentification } from '../../../submodules/guessit.js';

import type Oblecto from '../../oblecto/index.js';

interface SeriesIdentification {
    [key: string]: unknown;
    tvdbid?: number | null;
    tmdbid?: number | null;
    seriesName?: string | null;
    overview?: string | null;
}

interface EpisodeIdentification {
    [key: string]: unknown;
    airedSeason?: number | null;
    airedEpisodeNumber?: number | null;
    episodeName?: string | null;
}

type EpisodeGuessitIdentification = GuessitIdentification & {
    episode_name?: string;
    episode_title?: string;
};

type SeriesIdentifierConstructor = new (oblecto: Oblecto) => {
    identify: (path: string, guessit: GuessitIdentification) => Promise<SeriesIdentification>;
};

type EpisodeIdentifierConstructor = new (oblecto: Oblecto) => {
    identify: (
        path: string,
        guessit: EpisodeGuessitIdentification,
        series: SeriesIdentification
    ) => Promise<EpisodeIdentification>;
};

/**
 * Oblecto module to identify and index series and episodes
 */
export default class SeriesIndexer {
    public oblecto: Oblecto;
    public seriesIdentifier: AggregateIdentifier;
    public episodeIdentifer: AggregateIdentifier;
    public availableSeriesIdentifiers: string[];
    public availableEpisodeIdentifiers: string[];
    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.seriesIdentifier = new AggregateIdentifier();
        this.episodeIdentifer = new AggregateIdentifier();

        const seriesIdentifiers: Record<string, SeriesIdentifierConstructor> = {
            'tmdb': TmdbSeriesIdentifier,
            'tvdb': TvdbSeriesIdentifier,
        };

        const episodeIdentifiers: Record<string, EpisodeIdentifierConstructor> = {
            'tmdb': TmdbEpisodeIdentifier,
            'tvdb': TvdbEpisodeIdentifier
        };

        this.availableSeriesIdentifiers = Object.keys(seriesIdentifiers);
        this.availableEpisodeIdentifiers = Object.keys(episodeIdentifiers);

        for (const identifier of this.oblecto.config.tvshows.seriesIdentifiers) {
            logger.debug( `Loading ${identifier} series identifier`);
            this.seriesIdentifier.loadIdentifier(new seriesIdentifiers[identifier](this.oblecto));
        }

        for (const identifier of this.oblecto.config.tvshows.episodeIdentifiers) {
            logger.debug( `Loading ${identifier} episode identifier`);
            this.episodeIdentifer.loadIdentifier(new episodeIdentifiers[identifier](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('indexEpisode', async (job: { path: string }) => {
            await this.indexFile(job.path);
        });
    }

    /**
     * Identify and index the series of a given file
     * @param file - File to be indexed
     * @param guessitIdentification - Guessit identification Object
     * @param seriesIdentification
     * @returns - Matched series
     */
    async indexSeries(seriesIdentification: SeriesIdentification): Promise<Series> {
        const identifiers = ['tvdbid', 'tmdbid'];

        const seriesQuery: Array<Record<string, unknown>> = [];

        for (const identifier of identifiers) {
            if (!seriesIdentification[identifier]) continue;
            seriesQuery.push({ [identifier]: seriesIdentification[identifier] });
        }

        const [series, seriesCreated] = await Series.findOrCreate(
            {
                where: { [Op.or] : seriesQuery },
                defaults: seriesIdentification
            });

        if (seriesCreated) {
            this.oblecto.realTimeController.broadcast('indexer', { event: 'added', type: 'series', id: series.id });
            this.oblecto.queue.pushJob('updateSeries', series);
            this.oblecto.queue.queueJob('downloadSeriesPoster', series);
        }

        return series;
    }

    async identify(episodePath: string): Promise<{ series: SeriesIdentification; episode: EpisodeIdentification }>{
        const identificationNames = [path.basename(episodePath), episodePath];

        let guessitIdentification: EpisodeGuessitIdentification | undefined;
        let seriesIdentification: SeriesIdentification | undefined;

        let seriesIdentified = false;

        for (const name of identificationNames) {
            try {
                guessitIdentification = await guessit.identify(name);

                // Some single season shows usually don't have a season in the title,
                // therefore whe should set it to 1 by default.
                if (!guessitIdentification.season) {
                    guessitIdentification.season = 1;
                }

                seriesIdentification = await this.seriesIdentifier.identify(name, guessitIdentification);

                seriesIdentified = true;

                break;
            } catch (e) {
                logger.debug( 'Using for path for identifying', episodePath);
            }
        }

        if (seriesIdentified === false || !guessitIdentification || !seriesIdentification) {
            throw new IdentificationError('Could not identify series');
        }

        const episodeIdentification = await this.episodeIdentifer.identify(
            episodePath,
            guessitIdentification,
            seriesIdentification
        ) as EpisodeIdentification;

        return { series: seriesIdentification, episode: episodeIdentification };
    }

    /**
     * Index a specific file and identify it as a series
     * @param episodePath - Path to episode to index
     * @returns
     */
    async indexFile(episodePath: string): Promise<void> {
        const file = await this.oblecto.fileIndexer.indexVideoFile(episodePath);

        let seriesIdentification: SeriesIdentification;
        let episodeIdentification: EpisodeIdentification;

        try {
            ({ series: seriesIdentification, episode: episodeIdentification } = await this.identify(episodePath));
        } catch (e) {
            const error = e as Error & { name?: string; message?: string };

            if (error.name === 'IdentificationError') {
                await file.update({ problematic: true, error: error.message });
                return;
            }
            throw e;
        }

        const series = await this.indexSeries(seriesIdentification);

        logger.debug( `${file.path} episode identified ${episodeIdentification.episodeName}`);
         
        const [episode, episodeCreated] = await Episode.findOrCreate(
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
            this.oblecto.realTimeController.broadcast('indexer', { event: 'added', type: 'episode', id: episode.id });
            this.oblecto.queue.pushJob('updateEpisode', episode);
            this.oblecto.queue.queueJob('downloadEpisodeBanner', episode);
        }
    }

}
