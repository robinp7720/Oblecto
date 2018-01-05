import request from 'request'
import tmdb from "../../../submodules/tmdb";

const databases = require('../../../submodules/database');
const config = require('../../../config.json');
const async = require('async');
const path = require('path');
const recursive = require("recursive-readdir");
const fs = require("fs");


// TODO: Add config option to use the parent directory to identify movies
// TODO: Seperate Scanning and identifying

let indexer = {
    movieQueue: async.priorityQueue((task, callback) => {
        indexer.processMovie(task.path, callback)
    }, config.movies.concurrency),

    imageQueue: async.priorityQueue((task, callback) => {
        request.get({
            uri: task.url,
            encoding: null
        }, function (err, response, body) {
            fs.writeFile(task.path, body, callback);
        });
    }, 1),

    indexMovie(filePath) {
        indexer.movieQueue.push({
            path: filePath,
        }, 20);
    },

    indexDirectory(directory, callback) {
        // Read all the files/subdirectories in the directory
        recursive(directory, (err, files) => {
            if (err) {
                console.error(err);
                return false;
            }

            async.each(files, (file, callback) => {
                // Add file to the queue

                let extension = path.parse(file).ext;

                if (['.mp4','.avi'].indexOf(extension) > -1)
                    indexer.indexMovie(file, callback);

                callback();
            }, callback);
        });
    },

    indexAll(callback) {
        // Index all the directories specified in the config file
        async.each(config.movies.directories, (directory, callback) => {
            indexer.indexDirectory(directory, callback)
        }, callback);
    },

    processMovie(moviePath, callback) {
        let name = path.parse(moviePath).name;

        // If the year is present at the end of the name, remove it for the search
        // TODO: Using a regex mach, retrieve the year and use it in the search processes
        name = name.replace(/ \([0-9][0-9][0-9][0-9]\)/g, '');

        async.waterfall([
            // Search for the movie on The Movie Database and use the first result
            (callback) => tmdb.searchMovie({ query: name }, (err, res) => callback(err, res)),

            (res, callback) => {
                // Return if no matching movie was found
                if (res.total_results < 1) {
                    console.log("Could not identify", moviePath);
                    return callback();
                }

                let data = res.results[0];

                // Download assets for movie such as banners and posters and store them along side the movie files
                let posterPath = moviePath.replace(path.extname(moviePath), "-poster.jpg");
                let fanartPath = moviePath.replace(path.extname(moviePath), "-fanart.jpg");

                fs.exists(posterPath, function (exists) {
                    if (!exists) {
                        indexer.imageQueue.push({
                            path: posterPath,
                            url: "https://image.tmdb.org/t/p/w500" + data.poster_path
                        }, 20);

                    }
                });

                fs.exists(fanartPath, function (exists) {
                    if (!exists) {
                        indexer.imageQueue.push({
                            path: fanartPath,
                            url: "https://image.tmdb.org/t/p/w500" + data.backdrop_path
                        }, 20);
                    }
                });

                indexer.insertMovie(moviePath, data, callback);

            }
        ], (err) => {
            console.log(err);
            callback();
        });

    },

    insertMovie(moviePath, data, callback) {
        databases.movie
            .findOrCreate({
                where: {tmdbid: data.id}, defaults: {
                    movieName: data.title,
                    popularity: data.popularity,
                    releaseDate: data.release_date,
                    overview: data.overview,
                    file: moviePath
                }
            })
            .spread((movie, created) => {
                if (created)
                    console.log(movie.movieName, 'added to database');
                else
                    console.log(movie.movieName, 'was already in the database');

                console.log("Inserting", moviePath, "into the database");
                // Create file entity in the database
                databases.file.findOrCreate({
                    where: {path: moviePath},
                    defaults: {
                        name: path.parse(moviePath).name,
                        directory: path.parse(moviePath).dir,
                        extension: path.parse(moviePath).ext
                    }
                })
                    .spread((file, created) => {
                        movie.addFile(file);
                        callback();
                    });
            });
    }
};

module.exports = indexer;