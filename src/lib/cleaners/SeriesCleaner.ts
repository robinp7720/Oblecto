import { Op } from 'sequelize';
import { federatedMediaIds } from '../federation/catalog.js';
import { Episode } from '../../models/episode.js';
import { File } from '../../models/file.js';
import { Series } from '../../models/series.js';
import logger from '../../submodules/logger/index.js';

import type Oblecto from '../oblecto/index.js';

type EpisodeWithFiles = Episode & {
    Files?: File[];
};

type SeriesWithEpisodes = Series & {
    Episodes?: Episode[];
};

export default class SeriesCleaner {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Remove all episodes from the database without any linked files
     */
    async removeFileLessEpisodes(): Promise<void> {
        logger.info( 'Removing all episodes without linked files');
        const results = await Episode.findAll({ include: [File] }) as EpisodeWithFiles[];

        const retained = await federatedMediaIds('episode');
        for (const item of results) {
            if (retained.has(item.id)) continue;
            if (item.Files && item.Files.length > 0)
                continue;

            logger.info( 'Removing', item.episodeName, 'as it has no linked files');

            await item.destroy();
        }
    }

    /**
     * Remove all shows from the database without any defined path
     */
    async removePathLessShows(): Promise<void> {
        logger.info( 'Removing series without at attached path');
        const retained = await federatedMediaIds('series');
        await Series.destroy({ where: { directory: '', ...(retained.size ? { id: { [Op.notIn]: [...retained] } } : {}) } });
    }

    /**
     * Remove all shows from the database without any linked episodes
     */
    async removeEpisodeslessShows(): Promise<void> {
        logger.info( 'Removing series without attached episodes');
        const results = await Series.findAll({ include: [Episode] }) as SeriesWithEpisodes[];

        const retained = await federatedMediaIds('series');
        for (const item of results) {
            if (retained.has(item.id)) continue;
            if (item.Episodes && item.Episodes.length > 0)
                continue;

            logger.info( 'Removing', item.seriesName, 'as it has no linked episodes');

            await item.destroy();
        }
    }
}
