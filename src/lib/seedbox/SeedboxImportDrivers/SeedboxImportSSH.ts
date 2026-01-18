import SeedboxImportDriver, { SeedboxListEntry, SeedboxStorageDriverConfig } from '../SeedboxImportDriver.js';
import logger from '../../../submodules/logger/index.js';

import Client from 'ssh2-sftp-client';

export default class SeedboxImportSSH extends SeedboxImportDriver {
    public client: Client;

    constructor(config: SeedboxStorageDriverConfig) {
        super(config);

        this.client = new Client();
    }

    async setup(): Promise<void> {
        try {
            await this.client.connect({
                host: this.config.host,
                port: this.config.port || 22,
                user: this.config.username,
                password: this.config.password,
            });

        } catch (e) {
            logger.info(e);
        }
    }

    async list(path: string): Promise<SeedboxListEntry[]> {
        const listing = await this.client.list(path);

        return listing.map(item => {
            return {
                name: item.name,
                type: item.type === 'd'? 1:0
            };
        });
    }

    async copy(origin: string, destination: string): Promise<void> {
        const client =  new Client();

        await client.connect({
            host: this.config.host,
            port: this.config.port || 22,
            user: this.config.username,
            password: this.config.password,
        });

        await client.fastGet(origin, destination, {
            step: () => {
                // console.log(transfered, chunk, total, transfered/total);
            }
        });

        await client.end();
    }
}
