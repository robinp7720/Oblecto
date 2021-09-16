import SeedboxImportFTP from './SeedboxImportDrivers/SeedboxImportFTP';
import WarnExtendableError from '../errors/WarnExtendableError';

export default class Seedbox {
    constructor(seedboxConfig) {

    }

    initStorageDriver(seedboxStorageDriver, seedboxStorageDriverOptions) {
        switch (seedboxStorageDriver.toLowerCase()) {
            case 'ftp':
                this.storageDriver = new SeedboxImportFTP(seedboxStorageDriverOptions);
                return;
        }

        return new WarnExtendableError('Invalid seedbox storage driver');
    }
}
