import SeedboxImportDriver, { SeedboxListEntry, SeedboxStorageDriverConfig } from '../SeedboxImportDriver.js';
import logger from '../../../submodules/logger/index.js';

import Client from 'ssh2-sftp-client';

export default class SeedboxImportSSH extends SeedboxImportDriver {
    public client: Client;

    constructor(config: SeedboxStorageDriverConfig) {
        super(config);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        this.client = new (Client as any)();
    }

    async setup(): Promise<void> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const listing = await this.client.list(path);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return listing.map((item: any) => {
             
            return {
                name: item.name,
                type: item.type === 'd'? 1:0
            };
        });
    }

    async copy(origin: string, destination: string): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const client =  new (Client as any)();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await client.connect({
            host: this.config.host,
            port: this.config.port || 22,
            user: this.config.username,
            password: this.config.password,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await client.fastGet(origin, destination, {
            step: () => {
                // console.log(transfered, chunk, total, transfered/total);
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await client.end();
    }
}
