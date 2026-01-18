import { mkdirp } from 'mkdirp';

type ArtworkSizes = Record<string, unknown>;

type AssetConfig = {
    artwork: {
        fanart: ArtworkSizes;
        poster: ArtworkSizes;
        banner: ArtworkSizes;
    };
    assets: {
        movieFanartLocation: string;
        moviePosterLocation: string;
        showPosterLocation: string;
        episodeBannerLocation: string;
    };
};

const createDirectory = (dir: string): void => {
    console.log(`Creating directory ${dir}`);
    mkdirp.sync(dir);
};

/**
 * @param config - Oblecto config object
 */
export default function generateAssetDirectories(config: AssetConfig): void {
    // Create directories for image assets
    for (const size in config.artwork.fanart) {
        createDirectory(`${config.assets.movieFanartLocation}/${size}`);
    }

    for (const size in config.artwork.poster) {
        createDirectory(`${config.assets.moviePosterLocation}/${size}`);
        createDirectory(`${config.assets.showPosterLocation}/${size}`);
    }

    for (const size in config.artwork.banner) {
        createDirectory(`${config.assets.episodeBannerLocation}/${size}`);
    }

    const size = 'original';

    createDirectory(`${config.assets.movieFanartLocation}/${size}`);
    createDirectory(`${config.assets.moviePosterLocation}/${size}`);
    createDirectory(`${config.assets.showPosterLocation}/${size}`);
    createDirectory(`${config.assets.episodeBannerLocation}/${size}`);
}
