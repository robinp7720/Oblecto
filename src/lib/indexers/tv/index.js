import tvdb from "../../../submodules/tvdb";

const databases = require('../../../submodules/database');
const config = require('../../../config.json');
const async = require('async');
const path = require('path');
const recursive = require("recursive-readdir");
const fs = require("fs");


let indexer = {
    showQueue: async.priorityQueue((task, callback) => {
        indexer.processShow(task.name, task.path, callback)
    }, config.tvshows.concurrency),

    episodeQueue: async.priorityQueue((task, callback) => {
        indexer.processEpisode(task.path, task.episode, task.showid, task.localId, callback)
    }, config.tvshows.concurrency),

    indexShow(directory) {
        indexer.showQueue.push({
            path: directory,
            name: path.basename(directory),
        }, 20);
    },

    indexDirectory(directory, callback) {
        // Read all the files/subdirectories in the directory
        fs.readdir(directory, (err, files) => {
            // If an error has occurred, quit the processing of the directory
            if (err)
                return callback(err);

            // Loop through all the sub directories in the directory and add it to the index queue
            async.each(files, (file, callback) => {
                // Add file to the queue
                indexer.indexShow(directory + file);

                callback();
            }, callback);
        })
    },

    indexAll(callback) {
        // Index all the directories specified in the config file
        async.each(config.tvshows.directories, (directory, callback) => {
            indexer.indexDirectory(directory.path, callback)
        }, callback);
    },

    processEpisode(directory, episode, showid, localId, callback) {
        let seasonNum = episode.airedSeason;
        let episodeNum = episode.airedEpisodeNumber;

        async.waterfall([
            (callback) => {
                recursive(directory, callback);
            },
            (files, callback) => {
                async.filter(files, function (filePath, callback) {
                    // TODO: Improve episode scanning algorithm

                    filePath = filePath.toLowerCase();
                    let seasonFound = false;
                    let episodeFound = false;
                    let acceptedFormat = false;

                    // Try to find the season is correct
                    if (filePath.indexOf("s" + seasonNum + "e") > -1)
                        seasonFound = true;
                    if (filePath.indexOf("s0" + seasonNum + "e") > -1)
                        seasonFound = true;
                    if (filePath.indexOf("season " + seasonNum + " ") > -1)
                        seasonFound = true;
                    if (filePath.indexOf(" " + seasonNum + "x") > -1)
                        seasonFound = true;

                    // Try to find if the episode is correct
                    if (filePath.indexOf("e" + episodeNum + " ") > -1)
                        episodeFound = true;
                    if (filePath.indexOf("e" + episodeNum + ".") > -1)
                        episodeFound = true;
                    if (filePath.indexOf("e" + episodeNum + "-") > -1)
                        episodeFound = true;
                    if (filePath.indexOf("e0" + episodeNum + " ") > -1)
                        episodeFound = true;
                    if (filePath.indexOf("e0" + episodeNum + ".") > -1)
                        episodeFound = true;
                    if (filePath.indexOf("e0" + episodeNum + "-") > -1)
                        episodeFound = true;
                    if (filePath.indexOf("x" + ('0' + episodeNum).slice(-2) + "-") > -1)
                        episodeFound = true;

                    if (filePath.indexOf(".mp4") > -1)
                        acceptedFormat = true;
                    if (filePath.indexOf(".avi") > -1)
                        acceptedFormat = true;

                    callback(null, seasonFound && episodeFound && acceptedFormat);

                }, callback);
            },
            (files, callback) => {
                // If no file was found, then don't add the episode to the database
                if (files.length === 0)
                    return callback(null);

                databases.episode.findOrCreate({
                    where: {tvdbid: episode.id},
                    defaults: {
                        showid: showid,
                        tvshowId: localId,

                        episodeName: episode.episodeName,

                        absoluteNumber: episode.absoluteNumber,
                        airedEpisodeNumber: episode.airedEpisodeNumber,
                        airedSeason: episode.airedSeason,
                        airedSeasonID: episode.airedSeasonID,
                        dvdEpisodeNumber: episode.dvdEpisodeNumber,
                        dvdSeason: episode.dvdSeason,

                        firstAired: episode.firstAired,
                        overview: episode.overview,
                    }
                })
                    .spread((episode, created) => {
                        async.each(files, (file, callback) => {
                            console.log("Inserting", file, "into the database");
                            // Create file entity in the database
                            databases.file.findOrCreate({
                                where: {path: file},
                                defaults: {
                                    name: path.parse(file).name,
                                    directory: path.parse(file).dir,
                                    extension: path.parse(file).ext
                                }
                            })
                                .spread((file, created) => {
                                  episode.addFile(file);
                                  callback();
                                });

                        }, callback);
                    });

            }

        ], (err) => {
            callback();
        });
    },

    processShow(name, path, callback) {

        async.waterfall([
            (callback) => {
                // Get the show id from the name using a TVDB to search for the name
                tvdb.getSeriesByName(name)
                    .then((data) => callback(null, data[0].id))
                    .catch((err) => callback(err));
            },
            (id, callback) => {
                // Get extended show data from TVDB
                tvdb.getSeriesById(id)
                    .then((data) => callback(null, data))
                    .catch((err) => callback(err));
            },
            (data, callback) => {
                // Insert item into the database
                databases.tvshow
                    .findOrCreate({
                        where: {tvdbid: data.id}, defaults: {
                            seriesId: data.seriesId,
                            imdbid: data.imdbId,
                            zap2itId: data.zap2itId,

                            seriesName: data.seriesName,
                            alias: JSON.stringify(data.aliases),
                            genre: JSON.stringify(data.genre),
                            status: data.status,
                            firstAired: data.firstAired,
                            network: data.network,
                            runtime: data.runtime,
                            overview: data.overview,
                            airsDayOfWeek: data.airsDayOfWeek,
                            airsTime: data.airsTime,
                            rating: data.rating,

                            siteRating: data.siteRating,
                            siteRatingCount: data.siteRatingCount,

                            directory: path
                        }
                    })
                    .spread((show, created) => {
                        if (created)
                            console.log(show.seriesName, 'added to database');
                        else
                            console.log(show.seriesName, 'was already in the database');

                        callback(null, data, show.get({
                            plain: true
                        }))
                    });
            },
            (data, show, callback) => {
                // Instead of scanning the directory for episode files, retrieve all episodes for
                // TVDB and check if a corresponding file exists
                tvdb.getEpisodesBySeriesId(data.id)
                    .then((episodes) => {
                        async.each(episodes, (episode, callback) => {
                            // Add episode to the queue
                            indexer.episodeQueue.push({
                                episode: episode,
                                showid: data.id,
                                localId: show.id,
                                path: path
                            }, 20);

                            callback();
                        }, callback);
                    })
                    .catch((err) => callback(err))
            }

        ], (err) => {
            callback();
        });

    }
};

module.exports = indexer;