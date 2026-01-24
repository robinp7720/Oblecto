/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, jsdoc/require-returns-description */
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
    collectFile(file: string): void {
        const extension = path.parse(file).ext.toLowerCase().replace('.', '');

        if (this.oblecto.config.fileExtensions.video.indexOf(extension) !== -1) {
            this.oblecto.queue.queueJob('indexMovie',{ path: file });
        }
    }

    /**
     *
     * @returns
     */
    collectAll(): void {
        this.oblecto.config.movies.directories.forEach(directory => {
            void this.collectDirectory(directory.path);
        });
    }
}
