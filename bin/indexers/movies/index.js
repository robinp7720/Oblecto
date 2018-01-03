const databases = require('../../../submodules/database');
const tmdb = require('../../../submodules/tmdb');
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

                        callback();
                    });
            }
        ], (err) => {
            console.log(err);
            callback();
        });

    }
};

module.exports = indexer;