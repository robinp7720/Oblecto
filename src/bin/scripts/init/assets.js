import {promises as fs} from 'fs';
import generateAssetDirectories from '../helpers/generateAssetDirectories';

export default async (args) => {
    console.log('Initing assets');
    try {
        let config = JSON.parse(await fs.readFile('/etc/oblecto/config.json'));
        generateAssetDirectories(config);
    } catch (e) {
        console.log('Could not find config file');
        console.log('Make sure oblecto has been initialized before regenerating asset directories');
    }
};
