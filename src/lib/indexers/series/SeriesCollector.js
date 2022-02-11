import recursive from 'recursive-readdir';
import { extname } from 'path';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 */

/**
 * Module for oblecto to scan for media files which are to be indexed by the episode indexer
 */
export default class SeriesCollector {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *  Add all files within a directory to the queue to be indexed
     *
     * @param {string} directory - Which directory to add to the index queue
     * @returns {Promise<void>}
     */
    async collectDirectory(directory) {
        /**
         * @type {string[]}
         */
        const files = await recursive(directory);

        files.forEach(file => {
            this.collectFile(file);
        });
    }

    /**
     *  Queue a file to be indexed
     *
     * @param {string} file - File path to add to the index queue
     * @returns {Promise<void>}
     */
    async collectFile(file) {
        let extension = extname(file).toLowerCase().replace('.','');

        if (this.oblecto.config.fileExtensions.video.indexOf(extension) !== -1) {
            this.oblecto.queue.queueJob('indexEpisode',{ path: file });
        }
    }

    /**
     * Index all TV Show libraries
     *
     * @returns {Promise<void>}
     */
    async collectAll() {
        this.oblecto.config.tvshows.directories.forEach(directory => {
            this.collectDirectory(directory.path);
        });
    }
}
