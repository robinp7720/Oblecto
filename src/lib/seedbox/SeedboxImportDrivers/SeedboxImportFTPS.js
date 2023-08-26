import SeedboxImportDriver from '../SeedboxImportDriver';
import logger from '../../../submodules/logger';

import * as ftp from 'basic-ftp';

export default class SeedboxImportFTPS extends SeedboxImportDriver {
    constructor(config) {
        super(config);

        this.client = new ftp.Client();

        this.client.ftp.verbose = false;
    }

    async setup() {
        try {

            console.log(this.config);

            await this.client.access({
                host: this.config.host,
                user: this.config.username,
                password: this.config.password,
                secure: this.config.secure || false
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
                type: item.type - 1
            };
        });
    }

    async copy(origin, destination) {
        const client =  new ftp.Client();

        await client.access({
            host: this.config.host,
            user: this.config.username,
            password: this.config.password,
            secure: this.config.secure || false
        });

        return await client.downloadTo(destination, origin);
    }
}
