import databases from '../../../submodules/database';

import queue from '../../../submodules/queue';

import config from '../../../config.js';

import path from 'path';

import TvdbSeriesArtworkRetriever from './artworkRetrievers/TvdbSeriesArtworkRetriever';
import TmdbSeriesArtworkRetriever from './artworkRetrievers/TmdbSeriesArtworkRetriever';

import ImageManager from '../../ImageManager';


export default {
    artworkRetrievers: [
        TvdbSeriesArtworkRetriever,
        TmdbSeriesArtworkRetriever
    ],

    async DownloadEpisodeBanner(id) {
        let episode = await databases.episode.findByPk(id, {
            include: [databases.file, databases.tvshow]
        });


        let thumbnailPath = path.normalize(config.assets.episodeBannerLocation) + '/' + episode.id + '.jpg';

        if (config.assets.storeWithFile) {
            let episodePath = episode.files[0].path;

            thumbnailPath = episodePath.replace(path.extname(episodePath), '-thumb.jpg');
        }

        console.log('Checking thumbnail for', episode.tvshow.seriesName, `S${episode.airedSeason}E${episode.airedEpisodeNumber}:`, episode.episodeName);

        if (await ImageManager.imageExists(thumbnailPath))
            return;

        // Loop through all the artwork retrievers until an image has been found and downloaded

        for (let i in this.artworkRetrievers) {
            if (!this.artworkRetrievers.hasOwnProperty(i))
                continue;

            let artworkRetriever = this.artworkRetrievers[i];

            try {
                await artworkRetriever.retrieveEpisodeBanner(episode, thumbnailPath);
                return;
            } catch (e) {
                console.log(`Artwork retriever ${artworkRetriever.constructor.name} has failed. Continuing`);
            }
        }

        throw new Error('No banner could be found');
    },

    getPosterPath(series) {
        if (config.assets.storeWithFile) {
            return path.join(series.directory, series.seriesName + '-poster.jpg');
        }

        return path.normalize(config.assets.showPosterLocation) + '/' + series.id + '.jpg';
    },

    async downloadSeriesPoster(id) {
        let series = await databases.tvshow.findByPk(id);

        let posterPath = this.getPosterPath(series);

        if (await ImageManager.imageExists(posterPath)) {
            return;
        }

        console.log('Downloading poster image for', series.seriesName);

        for (let i in this.artworkRetrievers) {
            if (!this.artworkRetrievers.hasOwnProperty(i))
                continue;

            let artworkRetriever = this.artworkRetrievers[i];

            try {
                await artworkRetriever.retrieveSeriesPoster(series, posterPath);
                return;
            } catch (e) {
                console.log(`Artwork retriever ${artworkRetriever.constructor.name} has failed. Continuing`);
            }
        }

        throw new Error('No poster could be found');
    },

    /**
     * @return {boolean}
     */
    async downloadAllEpisodeBanners() {
        let Episodes = databases.episode.findAll();

        Episodes.each((Episode) => {
            queue.push({
                task: 'DownloadEpisodeBanner',
                id: Episode.id
            }, function (err) {

            });
        });

        return true;
    },

    /**
     * @return {boolean}
     */
    async downloadAllSeriesPosters() {
        let Shows = databases.tvshow.findAll();

        Shows.each((Show) => {
            queue.push({
                task: 'DownloadSeriesPoster',
                id: Show.id
            }, function (err) {

            });
        });

        return true;
    },

    async DownloadAll() {
        await this.downloadAllEpisodeBanners();
        await this.downloadAllSeriesPosters();
    }
};
