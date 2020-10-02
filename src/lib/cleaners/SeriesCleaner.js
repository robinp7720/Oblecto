import {Episode} from '../../models/episode';
import {File} from '../../models/file';
import {Series} from '../../models/series';
import logger from '../../submodules/logger';

export default class SeriesCleaner {
    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async removeFileLessEpisodes() {
        let results = await Episode.findAll({
            include: [File]
        });

        for (let item of results) {
            if (item.Files && item.Files.length > 0)
                continue;

            logger.log('INFO', 'Removing', item.episodeName, 'as it has no linked files');

            await item.destroy();
        }
    }

    async removePathLessShows() {
        await Series.destroy({
            where: {
                directory: ''
            }
        });
    }

    async removeEpisodeslessShows() {
        let results = await Series.findAll({
            include: [Episode]
        });

        for (let item of results) {
            if (item.Episodes && item.Episodes.length > 0)
                continue;

            logger.log('INFO', 'Removing', item.seriesName, 'as it has no linked episodes');

            await item.destroy();
        }
    }
}
