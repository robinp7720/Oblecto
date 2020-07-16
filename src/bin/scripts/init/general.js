import mkdirp from 'mkdirp';
import uuid from 'node-uuid';
import {promises as fs} from "fs";
import NodeRSA from 'node-rsa';

let createDirectory = function (dir) {
    console.log(`Creating directory ${dir}`);
    mkdirp(dir);
};

export default async (args) => {
    let config = JSON.parse(await fs.readFile(__dirname + '/../../../../res/config.json'));

    try {
        await fs.mkdir('/etc/oblecto');
    } catch (e) {
        if (e.code !== 'EEXIST') {
            console.log('Unable to create Oblecto data directory. Aborting');
            console.log('Please create the directory "/etc/oblecto" and give current user read/write permissions');
            return;
        }
    }

    // Create directories for image assets
    for (let size in config.artwork.fanart) {
        createDirectory(`${config.assets.movieFanartLocation} /${size}`);
    }

    for (let size in config.artwork.poster) {
        createDirectory(`${config.assets.moviePosterLocation}/${size}`);
        createDirectory(`${config.assets.showPosterLocation}/${size}`);
    }

    for (let size in config.artwork.banner) {
        createDirectory(`${config.assets.episodeBannerLocation}/${size}`);
    }

    let size = 'original';

    createDirectory(`${config.assets.movieFanartLocation} /${size}`);
    createDirectory(`${config.assets.moviePosterLocation}/${size}`);
    createDirectory(`${config.assets.showPosterLocation}/${size}`);
    createDirectory(`${config.assets.episodeBannerLocation}/${size}`);


    console.log('Generating federation UUID');
    config.federation.uuid = uuid.v4();

    console.log('Creating config file');
    try {
        await fs.writeFile('/etc/oblecto/config.json', JSON.stringify(config, null, 4));
    } catch (e) {
        console.log(e);
    }


    console.log('Generating federation authentication keys');
    const key = new NodeRSA({b: 2048});

    await fs.writeFile('/etc/oblecto/id_rsa', key.exportKey('pkcs1-private-pem'));
    await fs.writeFile('/etc/oblecto/id_rsa.pub', key.exportKey('pkcs1-public-pem'));

    console.log('Federation TLS keys will need to be generated manually');
    console.log('Please refer to the Oblecto wiki for instructions');
    console.log('https://github.com/robinp7720/Oblecto/wiki/Federation');

};
