import { extname, normalize as normalizePath } from 'path';
import WarnExtendableError from '../errors/WarnExtendableError.js';
import logger from '../../submodules/logger/index.js';
import SeedboxImportFTPS from './SeedboxImportDrivers/SeedboxImportFTPS.js';
import SeedboxImportSSH from './SeedboxImportDrivers/SeedboxImportSSH.js';

import type SeedboxImportDriver, { SeedboxStorageDriverConfig, SeedboxListEntry } from './SeedboxImportDriver.js';

type SeedboxConfig = {
    name: string;
    mediaImport: {
        movieDirectory: string;
        seriesDirectory: string;
    };
    storageDriver: string;
    storageDriverOptions: SeedboxStorageDriverConfig;
};

export default class Seedbox {
    public moviePath: string;
    public seriesPath: string;
    public name: string;
    public storageDriver: SeedboxImportDriver;

    constructor(seedboxConfig: SeedboxConfig) {
        this.moviePath = normalizePath(seedboxConfig.mediaImport.movieDirectory);
        this.seriesPath = normalizePath(seedboxConfig.mediaImport.seriesDirectory);
        this.name = seedboxConfig.name;

        this.storageDriver = this.initStorageDriver(seedboxConfig.storageDriver, seedboxConfig.storageDriverOptions);
    }

    initStorageDriver(seedboxStorageDriver: string, seedboxStorageDriverOptions: SeedboxStorageDriverConfig): SeedboxImportDriver {
        switch (seedboxStorageDriver.toLowerCase()) {
            case 'ftp':
            case 'ftps':
                return new SeedboxImportFTPS(seedboxStorageDriverOptions);
            case 'sftp':
            case 'ssh':
                return new SeedboxImportSSH(seedboxStorageDriverOptions);
        }

        return new WarnExtendableError('Invalid seedbox storage driver') as unknown as SeedboxImportDriver;
    }

    async setupDriver(): Promise<void> {
        await this.storageDriver.setup();
    }

    async findAll(indexPath: string, fileTypes: string[]): Promise<string[]> {
        logger.debug(`Finding files in ${indexPath}`);

        const toIndex: string[] = [];
        const indexed: string[] = [];

        toIndex.push(indexPath);

        while (toIndex.length > 0) {
            const current = toIndex.pop() as string;

            let entries: SeedboxListEntry[];

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
