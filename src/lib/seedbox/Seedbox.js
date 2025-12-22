import { extname, normalize as normalizePath } from 'path';
import WarnExtendableError from '../errors/WarnExtendableError';
import logger from '../../submodules/logger';
import SeedboxImportFTPS from './SeedboxImportDrivers/SeedboxImportFTPS';
import SeedboxImportSSH from './SeedboxImportDrivers/SeedboxImportSSH';

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
            case 'ftps':
                this.storageDriver = new SeedboxImportFTPS(seedboxStorageDriverOptions);
                return;
            case'sftp':
            case 'ssh':
                this.storageDriver = new SeedboxImportSSH(seedboxStorageDriverOptions);
                return;
        }

        return new WarnExtendableError('Invalid seedbox storage driver');
    }

    async setupDriver() {
        await this.storageDriver.setup();
    }

    async findAll(indexPath, fileTypes) {
        logger.debug(`Finding files in ${indexPath}`);

        const toIndex = [];
        const indexed = [];

        toIndex.push(indexPath);

        while (toIndex.length > 0) {
            let current = toIndex.pop();

            let entries;

            try {
                entries = await this.storageDriver.list(current);
            } catch (e) {
                logger.error(`Failed to list files from remote: ${this.name}`, e);
                continue;
            }

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
