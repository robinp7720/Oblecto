/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-floating-promises, jsdoc/require-returns-description */
import recursive from 'recursive-readdir';
import { extname } from 'path';

import type Oblecto from '../../oblecto/index.js';

/**
 */

/**
 * Module for oblecto to scan for media files which are to be indexed by the episode indexer
 */
export default class SeriesCollector {
    public oblecto: Oblecto;
    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *  Add all files within a directory to the queue to be indexed
     * @param directory - Which directory to add to the index queue
     * @returns
     */
    async collectDirectory(directory: string): Promise<void> {
        /**
         */
        const files = await recursive(directory);

        files.forEach(file => {
            this.collectFile(file);
        });
    }

    /**
     *  Queue a file to be indexed
     * @param file - File path to add to the index queue
     * @returns
     */
    async collectFile(file: string): Promise<void> {
        const extension = extname(file).toLowerCase().replace('.','');

        if (this.oblecto.config.fileExtensions.video.indexOf(extension) !== -1) {
            this.oblecto.queue.queueJob('indexEpisode',{ path: file });
        }
    }

    /**
     * Index all TV Show libraries
     * @returns
     */
    async collectAll(): Promise<void> {
        this.oblecto.config.tvshows.directories.forEach(directory => {
            this.collectDirectory(directory.path);
        });
    }
}
