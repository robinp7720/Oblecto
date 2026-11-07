import { File } from '../../../models/file.js';

import type { Dependencies } from '../../contracts.js';

type ServiceDependencies = Dependencies<'queue', never>;

/**
 * Module for oblecto to queue file updates
 */
export default class FileUpdateCollector {
    public oblecto: ServiceDependencies;

    /**
     *
     * @param oblecto - Required services and configuration
     */
    constructor(oblecto: ServiceDependencies) {
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
