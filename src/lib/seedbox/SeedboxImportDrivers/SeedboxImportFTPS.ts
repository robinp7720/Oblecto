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

    private connectOptions(): ftp.AccessOptions {
        return {
            host: this.config.host,
            port: this.config.port ?? 21,
            user: this.config.username,
            password: this.config.password,
            secure: this.config.secure ?? false
        };
    }

    async setup(): Promise<void> {
        try {
            await this.client.access(this.connectOptions());
        } catch (e) {
            logger.info(e);
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
        const client = new ftp.Client();

        try {
            await client.access(this.connectOptions());

            if (callback) {
                let size = 0;
                try {
                    size = await client.size(origin);
                } catch {
                    // Some servers do not support SIZE; progress still reports transferred bytes.
                }
                client.trackProgress(info => {
                    callback(info.bytes, size);
                });
            }

            await client.downloadTo(destination, origin);
        } finally {
            client.close();
        }
    }
}
