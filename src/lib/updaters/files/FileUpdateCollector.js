import {File} from '../../../models/file';

export default class FileUpdateCollector {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {File} file - File entity to update
     * @returns {Promise<void>}
     */
    async collectFile(file) {
        this.oblecto.queue.queueJob('updateFile', file);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllFiles() {
        let files = await File.findAll();

        for (let file of files) {
            this.collectFile(file);
        }
    }
}
