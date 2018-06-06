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
            return next(new errors.UnauthorizedError('Session is not authenticated'))

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                return next(new errors.UnauthorizedError('An error has occured during session authentication'))

            next();
        });
    };

    // Endpoint to get a list of episodes from all series
    server.get('/episodes/list/:sorting/:order', requiresAuth, async function (req, res, next) {

        let AllowedOrders = ["desc", "asc"];

        if (AllowedOrders.indexOf(req.params.order.toLowerCase()) === -1)
            return next(new errors.BadRequestError('Sorting order is invalid'))

        if (!(req.params.sorting in databases.episode.attributes))
            return next(new errors.BadRequestError('Sorting method is invalid'))

        let results = await databases.episode.findAll({
            include: [
                databases.tvshow,
                {
                    model: databases.trackEpisodes,
                    required: false,
                    where: {
                        userId: req.authorization.jwt.id
                    }
                }
            ],
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 30
        })

        res.send(results);
    });

    // Endpoint to get a banner image for an episode based on the local episode ID
    server.get('/episode/:id/image.png', async function (req, res, next) {
        // Get episode data
        let episode = await databases.episode.findById(req.params.id, {
            include: [databases.file]
        })

        let episodePath = episode.files[0].path;

        // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
        let thumbnailPath = episodePath.replace(path.extname(episodePath), "-thumb.jpg");

        // Check if the thumbnail exists
        fs.stat(thumbnailPath, function (err, stat) {
            if (err)
                return false;

            // If the thumbnail exists, simply pipe that to the client
            fs.createReadStream(thumbnailPath).pipe(res)

        });

    });

    // Endpoint to list all stored files for the specific episode
    server.get('/episode/:id/files', async function (req, res, next) {
        let episode = databases.episode.findById(req.params.id, {
            include: [databases.file]
        })

        res.send(episode.files);
        next();

    });


    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/episode/:id/play', async function (req, res, next) {
        // search for attributes
        let episode = await databases.episode.findById(req.params.id, {
            include: [databases.file]
        })

        let path = episode.files[0].path;
        var stat = fs.statSync(path);
        var total = stat.size;

        if (req.headers.range) { // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, "").split("-");
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : total - 1;
            var chunksize = (end - start) + 1;
            console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

            var file = fs.createReadStream(path, {
                start: start,
                end: end
            });
            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4'
            });
            file.pipe(res);

        } else {

            console.log('ALL: ' + total);
            res.writeHead(200, {
                'Content-Length': total,
                'Content-Type': 'video/mp4'
            });
            fs.createReadStream(path).pipe(res);
        }

    });

    // Endpoint to retrieve episode details based on the local episode ID
    server.get('/episode/:id/info', requiresAuth, async function (req, res, next) {
        // search for attributes
        let episode = await databases.episode.findById(req.params.id, {
            include: [databases.file]
        })

        episode = episode.toJSON();

        if (UserManager.hasSavedTVProgress(req.authorization.jwt.username, episode.id))
            episode.watchTime = UserManager.getSavedTVProgress(req.authorization.jwt.username, episode.id).time;

        res.send(episode);

    });

    // Endpoint to retrieve the episode next in series based on the local episode ID
    server.get('/episode/:id/next', requiresAuth, async function (req, res, next) {
        // search for attributes
        let results = await databases.episode.findById(req.params.id)
        let episode = await databases.episode.findOne({
            where: {
                showid: results.showid,
                [Op.or]: [{
                        [Op.and]: [{
                                airedEpisodeNumber: {
                                    [Op.gt]: results.airedEpisodeNumber
                                }
                            },
                            {
                                airedSeason: {
                                    [Op.gte]: results.airedSeason
                                }
                            },
                        ]
                    },
                    {
                        [Op.and]: [{
                            airedSeason: {
                                [Op.gt]: results.airedSeason
                            }
                        }, ]
                    }
                ]
            },
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC'],
            ]
        })

        res.send(episode);

    });
};