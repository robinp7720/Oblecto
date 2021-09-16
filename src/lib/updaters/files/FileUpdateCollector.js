import { File } from '../../../models/file';

import Oblecto from '../../oblecto';

/**
 * Module for oblecto to queue file updates
 */
export default class FileUpdateCollector {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
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
            await this.collectFile(file);
        }
    }
}
