import { extname, normalize as normalizePath } from 'path';
import SeedboxImportFTP from './SeedboxImportDrivers/SeedboxImportFTP';
import WarnExtendableError from '../errors/WarnExtendableError';
import logger from '../../submodules/logger';
import index from 'async';

export default class Seedbox {
    constructor(seedboxConfig) {
        this.moviePath = normalizePath(seedboxConfig.mediaImport.movieDirectory);
        this.seriesPath = normalizePath(seedboxConfig.mediaImport.seriesDirectory);
        this.name = seedboxConfig.name;

        this.initStorageDriver(seedboxConfig.storageDriver, seedboxConfig.storageDriverOptions);
    }

    initStorageDriver(seedboxStorageDriver, seedboxStorageDriverOptions) {
        switch (seedboxStorageDriver.toLowerCase()) {
            case 'ftp':
                this.storageDriver = new SeedboxImportFTP(seedboxStorageDriverOptions);
                return;
        }

        return new WarnExtendableError('Invalid seedbox storage driver');
    }

    async findAll(indexPath, fileTypes) {
        logger.log('DEBUG', `Finding files in ${indexPath}`);

        const toIndex = [];
        const indexed = [];

        toIndex.push(indexPath);

        while (toIndex.length > 0) {
            let current = toIndex.pop();

            const entries = await this.storageDriver.list(current);

            for (const entry of entries) {
                switch (entry.type) {
                    case 0: // Type 0 is a file
                        if (fileTypes.indexOf(extname(`${current}/${entry.name}`).replace('.','')) !== -1)
                            indexed.push(normalizePath(`${current}/${entry.name}`));
                        break;
                    case 1: // Type 1 is a directory
                        toIndex.push(normalizePath(`${current}/${entry.name}`));
                        break;
                }
            }
        }

        return indexed;
    }
}
