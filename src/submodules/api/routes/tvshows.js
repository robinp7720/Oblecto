import path from "path";
import jwt from "jsonwebtoken";
import fs from 'fs';

import tvdb from "../../../submodules/tvdb";
import databases from "../../../submodules/database";
import config from "../../../config";

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

    server.get('/shows/list/:sorting/:order', requiresAuth, function (req, res, next) {
        databases.tvshow.findAll({
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 30
        })
            .then((results) => res.send(results));
    });

    // Endpoint to request info based on the local series ID
    server.get('/series/:id/info', requiresAuth, function (req, res, next) {
        databases.tvshow.findById(req.params.id).then(show => {
            show.genre = JSON.parse(show.genre);
            res.send(show)
        })
    });

    // Endpoint to request a re-index of a series based on the local ID
    server.get('/series/:id/index', requiresAuth, function (req, res, next) {
        databases.tvshow.findById(req.params.id).then(show => {
            TVShowIndexer.indexShow(show.directory, () => {

            });

            res.send([true])
        })
    });

    // Endpoint to get all episodes within a series
    server.get('/series/:id/episodes', requiresAuth, function (req, res, next) {
        // search for attributes
        databases.episode.findAll({
            include: [databases.tvshow],
            where: {tvshowId: req.params.id},
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC']
            ],
        }).then(show => {
            res.send(show)
        })
    });

    // Endpoint to get the poster for a series
    server.get('/series/:id/poster', function (req, res, next) {
        databases.tvshow.findById(req.params.id).then(show => {
            let showPath = show.directory;
            let posterPath = path.join(showPath, show.seriesName + '-poster.jpg');

            // Check if the poster image already exits
            fs.exists(posterPath, function (exists) {
                if (exists) {
                    // If the image exits, simply pipe it to the client
                    fs.createReadStream(posterPath).pipe(res)
                } else {
                    // If it doesn't exist, download a new one and snd it to the client
                    tvdb.getSeriesPosters(show.tvdbid)
                        .then(function (data) {
                            console.log("Downloading poster image for", show.seriesName, "http://thetvdb.com/banners/" + data[0].fileName);
                            request.get({
                                uri: "http://thetvdb.com/banners/" + data[0].fileName,
                                encoding: null
                            }, function (err, response, body) {
                                fs.writeFile(posterPath, body, function (error) {
                                    if (!error)
                                        console.log("Poster downloaded for", show.seriesName);
                                });
                                res.contentType = 'image/jpeg';
                                res.send(body);
                                next()
                            })
                        })
                        .catch(function (error) {
                            res.send("");
                            next();
                        })
                }
            });
        });
    });

};