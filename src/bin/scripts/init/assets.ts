import { promises as fs } from 'fs';
import generateAssetDirectories from '../helpers/generateAssetDirectories.js';

export default async (args: string[]): Promise<void> => {
    try {
        const config = JSON.parse(await fs.readFile('/etc/oblecto/config.json', 'utf8')) as Parameters<typeof generateAssetDirectories>[0];

        generateAssetDirectories(config);
    } catch (e) {
        console.log('Could not find config file');
        console.log('Make sure oblecto has been initialized before regenerating asset directories');
    }
};
