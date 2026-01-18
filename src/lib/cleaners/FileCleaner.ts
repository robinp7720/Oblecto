import { promises as fs } from 'fs';
import { File } from '../../models/file.js';
import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';
import logger from '../../submodules/logger/index.js';

import type Oblecto from '../oblecto/index.js';

type FileWithAssociations = File & {
    Movies: Movie[];
    Episodes: Episode[];
};

export default class FileCleaner {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     * Remove all files which no longer exist on the filesystem from the database
     */
    async removedDeletedFiled(): Promise<void> {
        logger.info( 'Removing all non existent files from the database');
        const files = await File.findAll();

        for (const file of files) {
            try {
                await fs.stat(file.path as string);
            } catch (e) {
                logger.info( file.path, 'not found. Removing from database');

                await file.destroy();
            }
        }
    }

    /**
     * Remove all files from the database which no longer have any attached media items
     */
    async removeAssoclessFiles(): Promise<void> {
        logger.info( 'Removing files from the database without any attached media items');
        const results = await File.findAll({ include: [Movie, Episode] }) as FileWithAssociations[];

        results.forEach((item) => {
            if (item.Movies.length === 0 && item.Episodes.length === 0) {
                item.destroy();
            }
        });
    }
}
