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
        const offline = await this.offlineLibraries();

        for (const file of files) {
            const path = file.path as string;

            // An unmounted share looks exactly like every file in it having been deleted.
            if (offline.some(root => path.startsWith(root))) continue;

            try {
                await fs.stat(path);
            } catch (_) {
                logger.info( file.path, 'not found. Removing from database');

                await file.destroy();
            }
        }
    }

    /**
     * Library folders that are missing or empty, with a trailing slash. Their files are left alone:
     * that is how a network share that has not mounted yet looks, and cleaning it would drop the
     * whole library and everyone's watch progress with it.
     */
    async offlineLibraries(): Promise<string[]> {
        const config = this.oblecto.config as Oblecto['config'] | undefined;
        const roots = [...config?.movies?.directories ?? [], ...config?.tvshows?.directories ?? []].map(directory => directory.path);
        const offline: string[] = [];

        for (const root of roots) {
            const entries = await fs.readdir(root).catch(() => [] as string[]);

            if (entries.length === 0) {
                logger.warn(`Library folder ${root} is missing or empty; not removing its files from the database`);
                offline.push(root.endsWith('/') ? root : `${root}/`);
            }
        }

        return offline;
    }

    /**
     * Remove all files from the database which no longer have any attached media items.
     * Problematic files are kept: they are unattached because they could not be
     * identified, and deleting them would only drop their error and ignored
     * state until the next scan adds them again.
     */
    async removeAssoclessFiles(): Promise<void> {
        logger.info( 'Removing files from the database without any attached media items');
        const results = await File.findAll({ include: [Movie, Episode] }) as FileWithAssociations[];

        for (const item of results) {
            if (item.problematic) continue;

            if (item.Movies.length === 0 && item.Episodes.length === 0) {
                await item.destroy();
            }
        }
    }
}
