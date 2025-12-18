import { promises as fs } from 'fs';
import { File } from '../../models/file';
import { Movie } from '../../models/movie';
import { Episode } from '../../models/episode';
import logger from '../../submodules/logger';

export default class FileCleaner{
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Remove all files which no longer exist on the filesystem from the database
     *
     * @returns {Promise<void>}
     */
    async removedDeletedFiled () {
        logger.info( 'Removing all non existent files from the database');
        let files = await File.findAll();

        for (let file of files) {
            try {
                await fs.stat(file.path);
            } catch (e) {
                logger.info( file.path, 'not found. Removing from database');

                await file.destroy();
            }
        }

    }

    /**
     * Remove all files from the database which no longer have any attached media items
     *
     * @returns {Promise<void>}
     */
    async removeAssoclessFiles () {
        logger.info( 'Removing files from the database without any attached media items');
        let results = await File.findAll({ include: [Movie, Episode] });

        results.forEach((item) => {
            if (item.Movies.length === 0 && item.Episodes.length === 0) {
                item.destroy();
            }
        });
    }
}
