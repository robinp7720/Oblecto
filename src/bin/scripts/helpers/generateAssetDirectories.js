import { mkdirp } from 'mkdirp';

let createDirectory = function (dir) {
    console.log(`Creating directory ${dir}`);
    mkdirp(dir);
};

/**
 * @param {*} config - Oblecto config object
 */
export default function (config) {
    // Create directories for image assets
    for (let size in config.artwork.fanart) {
        createDirectory(`${config.assets.movieFanartLocation}/${size}`);
    }

    for (let size in config.artwork.poster) {
        createDirectory(`${config.assets.moviePosterLocation}/${size}`);
        createDirectory(`${config.assets.showPosterLocation}/${size}`);
    }

    for (let size in config.artwork.banner) {
        createDirectory(`${config.assets.episodeBannerLocation}/${size}`);
    }

    let size = 'original';

    createDirectory(`${config.assets.movieFanartLocation}/${size}`);
    createDirectory(`${config.assets.moviePosterLocation}/${size}`);
    createDirectory(`${config.assets.showPosterLocation}/${size}`);
    createDirectory(`${config.assets.episodeBannerLocation}/${size}`);
}
