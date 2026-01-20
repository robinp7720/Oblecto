/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-misused-promises, jsdoc/require-param-description, jsdoc/require-returns-description, jsdoc/check-param-names, @typescript-eslint/no-unnecessary-type-assertion */
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
