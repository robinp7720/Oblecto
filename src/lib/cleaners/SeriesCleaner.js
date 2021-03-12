import { Episode } from '../../models/episode';
import { File } from '../../models/file';
import { Series } from '../../models/series';
import logger from '../../submodules/logger';
import Oblecto from '../oblecto';

export default class SeriesCleaner {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Remove all episodes from the database without any linked files
     *
     * @returns {Promise<void>}
     */
    async removeFileLessEpisodes() {
        logger.log('INFO', 'Removing all episodes without linked files');
        let results = await Episode.findAll({ include: [File] });

        for (let item of results) {
            if (item.Files && item.Files.length > 0)
                continue;

            logger.log('INFO', 'Removing', item.episodeName, 'as it has no linked files');

            await item.destroy();
        }
    }

    /**
     * Remove all shows from the database without any defined path
     *
     * @returns {Promise<void>}
     */
    async removePathLessShows() {
        logger.log('INFO', 'Removing series without at attached path');
        await Series.destroy({ where: { directory: '' } });
    }

    /**
     * Remove all shows from the database without any linked episodes
     *
     * @returns {Promise<void>}
     */
    async removeEpisodeslessShows() {
        logger.log('INFO', 'Removing series without attached episodes');
        let results = await Series.findAll({ include: [Episode] });

        for (let item of results) {
            if (item.Episodes && item.Episodes.length > 0)
                continue;

            logger.log('INFO', 'Removing', item.seriesName, 'as it has no linked episodes');

            await item.destroy();
        }
    }
}
