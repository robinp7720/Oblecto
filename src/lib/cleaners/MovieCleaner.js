import { Movie } from '../../models/movie';
import { File } from '../../models/file';
import logger from '../../submodules/logger';
import Oblecto from '../oblecto';

export default class MovieCleaner {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Remove all movies from the database without any linked files
     *
     * @returns {Promise<void>}
     */
    async removeFileLessMovies() {
        logger.log('INFO', 'Removing movies without linked files');
        let results = await Movie.findAll({ include: [File] });

        for (let item of results) {
            if (item.Files && item.Files.length > 0)
                continue;

            logger.log('INFO', 'Removing', item.movieName, 'as it has no linked files');

            await item.destroy();
        }
    }
}
