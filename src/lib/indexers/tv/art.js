import databases from '../../../submodules/database';
import tvdb from '../../../submodules/tvdb';
import tmdb from '../../../submodules/tmdb';
import queue from '../../../submodules/queue';

import path from 'path';
import fs from 'fs';
import request from 'request';

export default {
    imageExists(imagePath) {
        // Assume the image exists at first
        let imageExists = true;

        try {
            let stat = fs.statSync(imagePath);

            // Re-download thumbnail if it's to small in size
            // This may mean that the thumbnail image is corrupt or wasn't downloaded properly the first time.
            if (stat.size < 1000) {
                // Delete the thumbnail
                fs.unlinkSync(imagePath);

                console.log('Image exists for', imagePath, 'but will be re-downloaded');
                throw 'poster to small';
            }

            console.log('Image exists for', imagePath);
        } catch (e) {
            // If an error has occurred above, it's because either the file stating threw an error or because the poster
            // image was to small.
            imageExists = false;
        }

        return imageExists;
    },

    async DownloadTVDBEpisodeBanner(episode, episodePath, thumbnailPath) {
        let data = await tvdb.getEpisodeById(episode.tvshow.tvdbid);

        return new Promise(function (fulfill, reject) {
            request.get({
                uri: 'https://thetvdb.com/banners/_cache/' + data.filename,
                encoding: null
            }, function (err, response, body) {
                if (err)
                    reject(err);

                fs.writeFile(thumbnailPath, body, function (error) {
                    if (error) {
                        console.error('An error has occured when downloading banner for', episodePath);
                    }

                    console.log('Image downloaded for', episodePath);

                    fulfill();
                });
            });
        });
    },

    async DownloadTMDBEpisodeBanner(episode, episodePath, thumbnailPath) {
        let data = await tmdb.tvEpisodeImages({
            id: episode.tvshow.tmdbid,
            episode_number: episode.airedEpisodeNumber,
            season_number: episode.airedSeason
        });

        return new Promise(function (fulfill, reject) {
            request.get({
                uri: 'https://image.tmdb.org/t/p/original' + data.stills[0]['file_path'],
                encoding: null
            }, function (err, response, body) {
                if (err)
                    reject(err);

                fs.writeFile(thumbnailPath, body, function (error) {
                    if (error) {
                        console.error('An error has occured when downloading banner for', episodePath);
                    }

                    console.log('Image downloaded for', episodePath);

                    fulfill();
                });
            });
        });
    },

    async DownloadEpisodeBanner(id) {
        let episode = await databases.episode.findById(id, {
            include: [databases.file, databases.tvshow]
        });

        let episodePath = episode.files[0].path;

        console.log('Checking thumbnail for', episodePath);

        // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
        let thumbnailPath = episodePath.replace(path.extname(episodePath), '-thumb.jpg');

        if (this.imageExists(thumbnailPath))
            return;

        // If no thumbnail was found, download one from TMDB or TVDB
        this.DownloadTMDBEpisodeBanner(episode, episodePath, thumbnailPath)
            .catch(() => {
                this.DownloadTVDBEpisodeBanner(episode, episodePath, thumbnailPath);
            });

    },

    async DownloadSeriesPoster(id) {
        let show = await databases.tvshow.findById(id);

        let showPath = show.directory;

        let posterPath = path.join(showPath, show.seriesName + '-poster.jpg');


        if (this.imageExists(posterPath))
            return;

        // Only download the poster if it doesn't exist

        let data = await tvdb.getSeriesPosters(show.tvdbid);

        console.log('Downloading poster image for', show.seriesName, 'http://thetvdb.com/banners/' + data[0].fileName);
        request.get({
            uri: 'http://thetvdb.com/banners/' + data[0].fileName,
            encoding: null
        }, function (err, response, body) {
            fs.writeFile(posterPath, body, function (error) {
                if (!error)
                    console.log('Poster downloaded for', show.seriesName);
            });
        });
    },

    /**
     * @return {boolean}
     */
    async DownloadAllEpisodeBanners() {
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
    async DownloadAllSeriesPosters() {
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
        await this.DownloadAllEpisodeBanners();
        await this.DownloadAllSeriesPosters();
    }
};