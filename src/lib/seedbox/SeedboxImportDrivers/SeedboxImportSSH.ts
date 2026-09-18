import SeedboxImportDriver, { SeedboxListEntry, SeedboxStorageDriverConfig, ProgressCallback } from '../SeedboxImportDriver.js';
import logger from '../../../submodules/logger/index.js';

import Client from 'ssh2-sftp-client';

export default class SeedboxImportSSH extends SeedboxImportDriver {
    public client: Client;

    constructor(config: SeedboxStorageDriverConfig) {
        super(config);

        this.client = new Client();
    }

    private connectOptions(): Client.ConnectOptions {
        return {
            host: this.config.host,
            port: this.config.port ?? 22,
            username: this.config.username,
            password: this.config.password
        };
    }

    async setup(): Promise<void> {
        try {
            await this.client.connect(this.connectOptions());
        } catch (e) {
            logger.info(e);
        }
    }

    async list(path: string): Promise<SeedboxListEntry[]> {
        const listing = await this.client.list(path);

        return listing.map(item => ({
            name: item.name,
            type: item.type === 'd' ? 1 : 0
        }));
    }

    async copy(origin: string, destination: string, callback?: ProgressCallback): Promise<void> {
        // A separate connection per transfer, so imports can run beside directory listings.
        const client = new Client();

        await client.connect(this.connectOptions());

        try {
            await client.fastGet(origin, destination, {
                step: (transferred: number, _chunk: number, total: number) => {
                    if (callback) callback(transferred, total);
                }
            });
        } finally {
            await client.end();
        }
    }
}
