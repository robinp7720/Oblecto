import jwt from "jsonwebtoken";
import sequelize from "sequelize";
import path from 'path';
import fs from 'fs';

import tvdb from "../../../submodules/tvdb";
import config from "../../../config";
import databases from "../../../submodules/database";
import UserManager from '../../../submodules/users';

const Op = sequelize.Op;

export default (server) => {

    const requiresAuth = function (req, res, next) {
        if (req.authorization === undefined)
            return next(false);

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                return next(false);

            next();
        });
    };


    // Endpoint to get a list of episodes from all series
    server.get('/episodes/list/:sorting/:order', requiresAuth, function (req, res, next) {
        databases.episode.findAll({
            include: [databases.tvshow],
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 30
        })
            .then((results) => res.send(results));
    });

    // Endpoint to get a banner image for an episode based on the local episode ID
    server.get('/episode/:id/image.png', function (req, res, next) {
        // Get episode data
        databases.episode.findById(req.params.id, {include: [databases.file]}).then(episode => {
            let episodePath = episode.files[0].path;
            console.log(episodePath);

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            let thumbnailPath = episodePath.replace(path.extname(episodePath), "-thumb.jpg");

            // Check if the thumbnail exists
            fs.exists(thumbnailPath, function (exists) {
                if (exists) {
                    // If the thumbnail exists, simply pipe that to the client
                    fs.createReadStream(thumbnailPath).pipe(res)
                } else {
                    // If no thumbnail was found, download one from thetvdb
                    tvdb.getEpisodeById(episode.tvdbid)
                        .then(function (data) {
                            request.get({
                                uri: "https://thetvdb.com/banners/_cache/" + data.filename,
                                encoding: null
                            }, function (err, response, body) {
                                fs.writeFile(thumbnailPath, body, function (error) {
                                    if (!error)
                                        console.log("Image downloaded for", episode.episodeName);
                                });
                                res.contentType = 'image/jpeg';
                                res.send(body);
                                next()
                            })
                        })
                        .catch(function (error) {
                            res.send(error);
                            next();
                        })
                }
            });
        });
    });


    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/episode/:id/play', function (req, res, next) {
        // search for attributes
        databases.episode.findById(req.params.id, {include: [databases.file]}).then(episode => {
            let path = episode.files[0].path;
            var stat = fs.statSync(path);
            var total = stat.size;

            if (req.headers.range) {   // meaning client (browser) has moved the forward/back slider
                // which has sent this request back to this server logic ... cool
                var range = req.headers.range;
                var parts = range.replace(/bytes=/, "").split("-");
                var partialstart = parts[0];
                var partialend = parts[1];

                var start = parseInt(partialstart, 10);
                var end = partialend ? parseInt(partialend, 10) : total - 1;
                var chunksize = (end - start) + 1;
                console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

                var file = fs.createReadStream(path, {start: start, end: end});
                res.writeHead(206, {
                    'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4'
                });
                file.pipe(res);

            } else {

                console.log('ALL: ' + total);
                res.writeHead(200, {'Content-Length': total, 'Content-Type': 'video/mp4'});
                fs.createReadStream(path).pipe(res);
            }
        })
    });

    // Endpoint to retrieve episode details based on the local episode ID
    server.get('/episode/:id/info', requiresAuth, function (req, res, next) {
        // search for attributes
        databases.episode.findById(req.params.id, {include: [databases.file]}).then(episode => {
            episode = episode.toJSON();

            if (UserManager.hasSavedProgress(req.authorization.jwt.username, episode.id))
                episode.watchTime = UserManager.getSavedProgress(req.authorization.jwt.username, episode.id).time;

            res.send(episode);
        })
    });

    // Endpoint to retrieve the episode next in series based on the local episode ID
    server.get('/episode/:id/next', requiresAuth, function (req, res, next) {
        // search for attributes
        databases.episode.findById(req.params.id).then(results => {
            databases.episode.findOne({
                where: {
                    showid: results.showid,
                    [Op.or]: [
                        {
                            [Op.and]: [
                                {airedEpisodeNumber: {[Op.gt]: results.airedEpisodeNumber}},
                                {airedSeason: {[Op.gte]: results.airedSeason}},
                            ]
                        },
                        {
                            [Op.and]: [
                                {airedSeason: {[Op.gt]: results.airedSeason}},
                            ]
                        }
                    ]
                },
                order: [
                    ['airedSeason', 'ASC'],
                    ['airedEpisodeNumber', 'ASC'],
                ]
            }).then(episode => {
                res.send(episode);
            })
        })
    });
};