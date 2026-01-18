import { Movie } from '../../models/movie.js';
import { File } from '../../models/file.js';
import logger from '../../submodules/logger/index.js';

import type Oblecto from '../oblecto/index.js';

type MovieWithFiles = Movie & {
    Files?: File[];
};

export default class MovieCleaner {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Remove all movies from the database without any linked files
     */
    async removeFileLessMovies(): Promise<void> {
        logger.info( 'Removing movies without linked files');
        const results = await Movie.findAll({ include: [File] }) as MovieWithFiles[];

        for (const item of results) {
            if (item.Files && item.Files.length > 0)
                continue;

            logger.info( 'Removing', item.movieName, 'as it has no linked files');

            await item.destroy();
        }
    }
}
