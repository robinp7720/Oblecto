import SeedboxImportDriver, { SeedboxListEntry, SeedboxStorageDriverConfig, ProgressCallback } from '../SeedboxImportDriver.js';
import logger from '../../../submodules/logger/index.js';

import * as ftp from 'basic-ftp';

export default class SeedboxImportFTPS extends SeedboxImportDriver {
    public client: ftp.Client;

    constructor(config: SeedboxStorageDriverConfig) {
        super(config);

        this.client = new ftp.Client();

        this.client.ftp.verbose = false;
    }

    async setup(): Promise<void> {
        try {
            await this.client.access({
                host: this.config.host,
                user: this.config.username,
                password: this.config.password,
                secure: this.config.secure || false
            });

        } catch (e) {
            logger.info( e);
        }
    }

    async list(path: string): Promise<SeedboxListEntry[]> {
        const listing = await this.client.list(path);

        return listing.map(item => {
            return {
                name: item.name,
                type: item.type - 1
            };
        });
    }

    async copy(origin: string, destination: string, callback?: ProgressCallback): Promise<void> {
        const client =  new ftp.Client();

        await client.access({
            host: this.config.host,
            user: this.config.username,
            password: this.config.password,
            secure: this.config.secure || false
        });

        if (callback) {
            try {
                const size = await client.size(origin);
                client.trackProgress(info => {
                    callback(info.bytes, size);
                });
            } catch (e) {
                // Ignore size fetch errors, maybe pass 0 as total
                client.trackProgress(info => {
                    callback(info.bytes, 0);
                });
            }
        }

        await client.downloadTo(destination, origin);
    }
}
