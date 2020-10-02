import recursive from 'recursive-readdir';
import path from 'path';

export default class MovieCollector {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {String} directory - Which directory to add to the index queue
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
     * @param {String} file - File path to add to the index queue
     * @returns {Promise<void>}
     */
    async collectFile(file) {
        let extension = path.parse(file).ext.toLowerCase();

        if (this.oblecto.config.fileExtensions.video.indexOf(extension) !== -1) {
            this.oblecto.queue.queueJob('indexMovie',{path: file});
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
