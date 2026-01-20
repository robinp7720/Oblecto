import recursive from 'recursive-readdir';
import path from 'path';

import type Oblecto from '../../oblecto/index.js';

export default class MovieCollector {
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
     * @param directory - Which directory to add to the index queue
     * @returns
     */
    async collectDirectory(directory: string): Promise<void> {
        const files = await recursive(directory);

        files.forEach(file => {
            this.collectFile(file);
        });
    }

    /**
     *
     * @param file - File path to add to the index queue
     * @returns
     */
    async collectFile(file: string): Promise<void> {
        const extension = path.parse(file).ext.toLowerCase().replace('.', '');

        if (this.oblecto.config.fileExtensions.video.indexOf(extension) !== -1) {
            this.oblecto.queue.queueJob('indexMovie',{ path: file });
        }
    }

    /**
     *
     * @returns
     */
    async collectAll(): Promise<void> {
        this.oblecto.config.movies.directories.forEach(directory => {
            this.collectDirectory(directory.path);
        });
    }
}
