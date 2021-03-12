import recursive from 'recursive-readdir';
import path from 'path';

import Oblecto from '../../oblecto';

export default class MovieCollector {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {string} directory - Which directory to add to the index queue
     * @returns {Promise<void>}
     */
    async collectDirectory(directory) {
        let files = await recursive(directory);

        files.forEach(file => {
            this.collectFile(file);
        });
    }

    /**
     *
     * @param {string} file - File path to add to the index queue
     * @returns {Promise<void>}
     */
    async collectFile(file) {
        let extension = path.parse(file).ext.toLowerCase();

        if (this.oblecto.config.fileExtensions.video.indexOf(extension) !== -1) {
            this.oblecto.queue.queueJob('indexMovie',{ path: file });
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAll() {
        this.oblecto.config.movies.directories.forEach(directory => {
            this.collectDirectory(directory.path);
        });
    }
}
