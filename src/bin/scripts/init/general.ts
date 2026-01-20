/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return */
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import NodeRSA from 'node-rsa';
import generateAssetDirectories from '../helpers/generateAssetDirectories.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async (args: string[]): Promise<void> => {
    if (args.length === 1) args[1] = 'oblecto';

    const config = JSON.parse(await fs.readFile(path.join(process.cwd(), 'res/config.json'), 'utf8')) as Parameters<typeof generateAssetDirectories>[0] & {
        authentication: { secret?: string; saltRounds?: number };
        federation: { uuid?: string };
    };

    try {
        await fs.mkdir('/etc/oblecto');
    } catch (e) {
        const error = e as NodeJS.ErrnoException;

        if (error.code !== 'EEXIST') {
            console.log('Unable to create Oblecto data directory. Aborting');
            console.log('Please create the directory "/etc/oblecto" and give current user read/write permissions');
            return;
        }
    }

    generateAssetDirectories(config);

    config.authentication.secret = uuidv4();

    console.log('Generating federation UUID');
    config.federation.uuid = uuidv4();

    console.log('Creating config file');
    try {
        await fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4));
    } catch (e) {
        console.log(e);
    }

    console.log('Generating federation authentication keys');
    const key = new NodeRSA({ b: 2048 });

    await fs.writeFile('/etc/oblecto/id_rsa', key.exportKey('pkcs1-private-pem'));
    await fs.writeFile('/etc/oblecto/id_rsa.pub', key.exportKey('pkcs1-public-pem'));

    console.log('Federation TLS keys will need to be generated manually');
    console.log('Please refer to the Oblecto wiki for instructions');
    console.log('https://github.com/robinp7720/Oblecto/wiki/Federation');
};
