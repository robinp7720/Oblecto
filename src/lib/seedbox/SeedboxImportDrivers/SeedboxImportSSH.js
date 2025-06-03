import SeedboxImportDriver from '../SeedboxImportDriver';
import logger from '../../../submodules/logger';
import fs from 'fs';

import Client from 'ssh2-sftp-client';

export default class SeedboxImportSSH extends SeedboxImportDriver {
    constructor(config) {
        super(config);

        this.client = new Client();
    }

    async setup() {
        try {

            console.log(this.config);

            await this.client.connect({
                host: this.config.host,
                port: this.config.port || 22,
                user: this.config.username,
                password: this.config.password,
            });

        } catch (e) {
            logger.log('INFO', e);
        }
    }

    async list(path) {
        const listing = await this.client.list(path);

        return listing.map(item => {
            return {
                name: item.name,
                type: item.type === 'd'? 1:0
            };
        });
    }

    async copy(origin, destination) {
        const client =  new Client();

        await client.connect({
            host: this.config.host,
            port: this.config.port || 22,
            user: this.config.username,
            password: this.config.password,
        });

        await client.fastGet(origin, destination, {
            step: (transfered, chunk, total) => {
                // console.log(transfered, chunk, total, transfered/total);
            }
        });

        await client.end();
    }
}
