import databases from '../../../submodules/database';
import tmdb from '../../../submodules/tmdb';
import queue from '../../../submodules/queue';

import config from "../../../config.json";

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

    async DownloadTMDBMovieFanart(movie, imagePath) {
        let data = await tmdb.movieImages({
            id: movie.tmdbid
        });

        return new Promise(function (fulfill, reject) {
            request.get({
                uri: 'https://image.tmdb.org/t/p/original' + data.backdrops[0]['file_path'],
                encoding: null
            }, function (err, response, body) {
                if (err)
                    reject(err);

                fs.writeFile(imagePath, body, function (error) {
                    if (error) {
                        reject(error)
                    }

                    console.log('Image downloaded for', movie.movieName);

                    fulfill();
                });
            });
        });
    },

    async DownloadTMDBMoviePoster(movie, imagePath) {
        let data = await tmdb.movieImages({
            id: movie.tmdbid
        });

        return new Promise(function (fulfill, reject) {
            request.get({
                uri: 'https://image.tmdb.org/t/p/original' + data.posters[0]['file_path'],
                encoding: null
            }, function (err, response, body) {
                if (err)
                    reject(err);

                fs.writeFile(imagePath, body, function (error) {
                    if (error) {
                        reject(error)
                    }

                    console.log('Image downloaded for', movie.movieName);

                    fulfill();
                });
            });
        });
    },

    async DownloadMovieFanart(id) {
        let movie = await databases.movie.findById(id, {
            include: [databases.file]
        });

        let moviePath = movie.files[0].path;

        console.log('Checking fanart for', moviePath);

        // Set the fanart to have the same name but with -thumb.jpg instead of the video file extension
        let imagePath = moviePath.replace(path.extname(moviePath), '-thumb.jpg');

        if (!config.assets.storeWithFile) {
            imagePath = path.normalize(config.assets.movieFanartLocation) + '/' + movie.id + ".jpg"
        }

        if (this.imageExists(imagePath))
            return;


        return this.DownloadTMDBMovieFanart(movie, imagePath);


    },

    async DownloadMoviePoster(id) {
        let movie = await databases.movie.findById(id, {
            include: [databases.file]
        });

        let moviePath = movie.files[0].path;

        console.log('Checking poster for', moviePath);

        // Set the fanart to have the same name but with -thumb.jpg instead of the video file extension
        let imagePath = moviePath.replace(path.extname(moviePath), '-thumb.jpg');

        if (!config.assets.storeWithFile) {
            imagePath = path.normalize(config.assets.moviePosterLocation) + '/' + movie.id + ".jpg"
        }

        if (this.imageExists(imagePath))
            return;


        return this.DownloadTMDBMoviePoster(movie, imagePath);

    },

    /**
     * @return {boolean}
     */
    async DownloadAllMoviesFanart() {
        let Episodes = databases.movie.findAll();

        Episodes.each((movie) => {
            queue.push({
                task: 'DownloadMovieFanart',
                id: movie.id
            }, function (err) {

            });
        });

        return true;
    },

    /**
     * @return {boolean}
     */
    async DownloadAllMoviePosters() {
        let Shows = databases.movie.findAll();

        Shows.each((movie) => {
            queue.push({
                task: 'DownloadMoviePoster',
                id: movie.id
            }, function (err) {

            });
        });

        return true;
    },

    async DownloadAll() {
        await this.DownloadAllMoviesFanart();
        await this.DownloadAllMoviePosters();
    }
};