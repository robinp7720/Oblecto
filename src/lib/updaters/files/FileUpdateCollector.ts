import { File } from '../../../models/file.js';

import type Oblecto from '../../oblecto/index.js';

/**
 * Module for oblecto to queue file updates
 */
export default class FileUpdateCollector {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param file - File entity to update
     */
    async collectFile(file: File): Promise<void> {
        this.oblecto.queue.queueJob('updateFile', file);
    }

    /**
     *
     */
    async collectAllFiles(): Promise<void> {
        const files = await File.findAll();

        for (const file of files) {
            await this.collectFile(file);
        }
    }
}
