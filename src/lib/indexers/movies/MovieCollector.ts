/* eslint-disable jsdoc/require-returns-description */
import recursive from 'recursive-readdir';
import path from 'path';

import type { Dependencies } from '../../contracts.js';

type ServiceDependencies = Dependencies<'queue', 'fileExtensions' | 'movies'>;

export default class MovieCollector {
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
    async collectAll(): Promise<void> {
        const results = await Promise.allSettled(this.oblecto.config.movies.directories.map(directory => this.collectDirectory(directory.path)));
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map((result): unknown => result.reason), 'Could not scan some library directories');
    }
}
