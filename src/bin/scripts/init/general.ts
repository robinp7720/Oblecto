import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import NodeRSA from 'node-rsa';
import path from 'path';
import generateAssetDirectories from '../helpers/generateAssetDirectories.js';
import { configPath } from '../../../config.js';
import { findPackageRoot } from '../../../lib/packageRoot.js';
import type { IConfig } from '../../../interfaces/config.js';

const DEFAULT_DIRECTORY = '/etc/oblecto';

// Paths in the template that live under the data directory and move with it.
const relocate = (value: string, directory: string): string =>
    value.startsWith(`${DEFAULT_DIRECTORY}/`) ? path.join(directory, value.slice(DEFAULT_DIRECTORY.length + 1)) : value;

/**
 * oblecto init [--config-dir DIR] [--force]
 * Writes a config with a random signing secret into DIR (the directory of OBLECTO_CONFIG_PATH, or
 * /etc/oblecto), creates the artwork directories and generates the federation key pair.
 */
export default async (args: string[]): Promise<void> => {
    const flag = args.indexOf('--config-dir');
    const directory = path.resolve(flag !== -1 && args[flag + 1] ? args[flag + 1] : path.dirname(configPath()));
    const file = path.join(directory, 'config.json');

    try {
        await fs.access(file);

        if (!args.includes('--force')) {
            console.log(`${file} already exists; leaving it alone. Run "oblecto init --force" to replace it.`);
            return;
        }
    } catch {
        // No config yet: carry on.
    }

    try {
        await fs.mkdir(directory, { recursive: true });
    } catch {
        console.log(`Unable to create the Oblecto data directory ${directory}. Aborting.`);
        console.log('Create it and give the user running Oblecto read and write access, or choose another with --config-dir.');
        process.exitCode = 1;
        return;
    }

    const template = JSON.parse(await fs.readFile(path.join(findPackageRoot(), 'res/config.json'), 'utf8')) as IConfig;
    const config = structuredClone(template);

    for (const key of Object.keys(config.assets) as (keyof IConfig['assets'])[]) {
        const value = config.assets[key];

        if (typeof value === 'string') (config.assets as Record<string, unknown>)[key] = relocate(value, directory);
    }
    if (config.database.storage) config.database.storage = relocate(config.database.storage, directory);
    config.federation.key = relocate(config.federation.key, directory);
    if (config.federation.cert) config.federation.cert = relocate(config.federation.cert, directory);

    generateAssetDirectories(config);

    config.authentication.secret = uuidv4();
    config.federation.uuid = uuidv4();

    console.log(`Creating config file ${file}`);
    // Owner-only: the file holds the signing secret and provider keys.
    await fs.writeFile(file, JSON.stringify(config, null, 4), { mode: 0o600 });

    console.log('Generating federation authentication keys');
    const key = new NodeRSA({ b: 2048 });

    await fs.writeFile(config.federation.key, key.exportKey('pkcs1-private-pem'), { mode: 0o600 });
    await fs.writeFile(`${config.federation.key}.pub`, key.exportKey('pkcs1-public-pem'));

    console.log('Done. Next: add your library folders, then run "oblecto start".');
    console.log('Federation also needs a TLS certificate at federation.cert, but only if you turn federation on.');
};
