import databases from '../../../submodules/database';

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
        let allFiles = databases.file.findAll();

        allFiles.each((file) => {
            this.collectFile(file);
        });
    }
}
