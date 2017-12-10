const async = require("async"),
    fs = require("fs"),
    recursive = require("recursive-readdir");

class indexer {
    constructor(config, tvshows, episodes, tvdb) {
        this.config = config;
        this.tvshow = tvshows;
        this.episodes = episodes;
        this.tvdb = tvdb;

        this.episodequeue = async.priorityQueue((task, callback) => {
            let season = task.episode.airedSeason;
            let episode = task.episode.airedEpisodeNumber;

            async.waterfall([
                (callback) => {
                    recursive(task.path, callback);
                },
                (files, callback) => {
                    async.filter(files, function (filePath, callback) {
                        filePath = filePath.toLowerCase();
                        let seasonFound = false;
                        let episodeFound = false;
                        let acceptedFormat = false;

                        // Try to find the season is correct
                        if (filePath.indexOf("s" + season + "e") > -1)
                            seasonFound = true;
                        if (filePath.indexOf("s0" + season + "e") > -1)
                            seasonFound = true;
                        if (filePath.indexOf("season " + season + " ") > -1)
                            seasonFound = true;
                        if (filePath.indexOf(" " + season + "x") > -1)
                            seasonFound = true;

                        // Try to find if the episode is correct
                        if (filePath.indexOf("e" + episode + " ") > -1)
                            episodeFound = true;
                        if (filePath.indexOf("e" + episode + ".") > -1)
                            episodeFound = true;
                        if (filePath.indexOf("e" + episode + "-") > -1)
                            episodeFound = true;
                        if (filePath.indexOf("e0" + episode + " ") > -1)
                            episodeFound = true;
                        if (filePath.indexOf("e0" + episode + ".") > -1)
                            episodeFound = true;
                        if (filePath.indexOf("e0" + episode + "-") > -1)
                            episodeFound = true;
                        if (filePath.indexOf("x" + ('0' + episode).slice(-2) + "-") > -1)
                            episodeFound = true;

                        if (filePath.indexOf(".mp4") > -1)
                            acceptedFormat = true;
                        if (filePath.indexOf(".avi") > -1)
                            acceptedFormat = true;

                        callback(null, seasonFound && episodeFound && acceptedFormat);

                    }, callback);
                },
                (files, callback) => {
                    if (files.length===0)
                        return callback(null);
                    task.self.episodes.create({
                        tvdbid: task.episode.id,
                        showid: task.showid,
                        tvshowId: task.tvshowid,

                        episodeName: task.episode.episodeName,

                        absoluteNumber: task.episode.absoluteNumber,
                        airedEpisodeNumber: task.episode.airedEpisodeNumber,
                        airedSeason: task.episode.airedSeason,
                        airedSeasonID: task.episode.airedSeasonID,
                        dvdEpisodeNumber: task.episode.dvdEpisodeNumber,
                        dvdSeason: task.episode.dvdSeason,

                        firstAired: task.episode.firstAired,
                        overview: task.episode.overview,

                        file: files[0]
                    })
                        .then(() => callback(null))
                        .catch((err) => callback(null));
                }

            ], (err) => {
                callback();
            });
        }, config.indexer.concurrency);

        // Start indexer queue
        this.showqueue = async.priorityQueue((task, callback) => {
            async.waterfall([
                (callback) => {
                    // Get the show id from the name using a TVDB to search for the name
                    task.self.tvdb.getSeriesByName(task.name)
                        .then((data) => callback(null, data[0].id))
                        .catch((err) => callback(err));
                },
                (id, callback) => {
                    // Get extended show data from TVDB
                    task.self.tvdb.getSeriesById(id)
                        .then((data) => callback(null, data))
                        .catch((err) => callback(err));
                },
                (data, callback) => {
                    // Insert item into the database
                    task.self.tvshow
                        .findOrCreate({where: {tvdbid: data.id}, defaults: {
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

                                directory: task.path
                            }})
                        .spread((show, created) => {
                            callback(null, data, show.get({
                                plain: true
                            }))
                        });
                },
                (data, show, callback) => {
                    console.log(show);
                    // Instead of scanning the directory for episode files, instead retrieve all episodes for
                    // TVDB and check if a corresponding file exists
                    task.self.tvdb.getEpisodesBySeriesId(data.id)
                        .then((episodes) => {
                            async.each(episodes, (episode, callback) => {
                                // Add episode to the queue
                                task.self.episodequeue.push({
                                    episode: episode,
                                    showid: data.id,
                                    tvshowid: show.id,
                                    path: task.path,
                                    self: task.self
                                }, 20);

                                callback();
                            }, callback);
                        })
                        .catch((err) => callback(err))
                }

            ], (err) => {
                callback();
            });
        }, config.indexer.concurrency);
    }

    index(directory, callback) {
        let self = this;

        fs.readdir(directory.path, (err, files) => {
            if (err)
                return callback(err);

            async.each(files, (file, callback) => {
                // Add file to the queue
                self.showqueue.push({
                    path: directory.path + file,
                    name: file,
                    self: self
                }, 20);

                callback();
            }, callback);
        })
    };

    indexAll(callback) {
        // Index all the directories specified in the config file
        async.each(this.config.tvshows.directories, (directory, callback) => {
            this.index(directory, callback)
        }, callback);
    };
}

module.exports = indexer;