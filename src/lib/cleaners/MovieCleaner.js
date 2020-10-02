import {Movie} from '../../models/movie';
import {File} from '../../models/file';
import logger from '../../submodules/logger';

export default class MovieCleaner {
    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async removeFileLessMovies() {
        let results = await Movie.findAll({
            include: [File]
        });

        for (let item of results) {
            if (item.Files && item.Files.length > 0)
                continue;

            logger.log('INFO', 'Removing', item.movieName, 'as it has no linked files');


            await item.destroy();
        }
    }
}
