import jwt from "jsonwebtoken";
import path from 'path';
import fs from 'fs';

import config from "../../../config";
import databases from "../../../submodules/database";
import tvdb from "../../tvdb";
import UserManager from "../../users";

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
    server.get('/movies/list/:sorting/:order', requiresAuth, function (req, res, next) {
        databases.movie.findAll({
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 30
        })
            .then((results) => res.send(results));
    });



    // Endpoint to get a poster based on localId
    server.get('/movie/:id/poster', function (req, res, next) {
        // Get episode data
        databases.movie.findById(req.params.id, {include: [databases.file]}).then(movie => {
            if (!movie.files[0]) {
                res.errorCode = 404;
                return res.send()
            }

            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            let posterPath = moviePath.replace(path.extname(moviePath), "-poster.jpg");

            // Check if the thumbnail exists
            fs.exists(posterPath, function (exists) {
                if (exists) {
                    // If the thumbnail exists, simply pipe that to the client
                    fs.createReadStream(posterPath).pipe(res)
                } else {
                    res.errorCode = 404;
                    return res.send()
                }
            });
        });
    });

    // Endpoint to get a fanart based on localId
    server.get('/movie/:id/fanart', function (req, res, next) {
        // Get episode data
        databases.movie.findById(req.params.id, {include: [databases.file]}).then(movie => {
            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            let fanartPath = moviePath.replace(path.extname(moviePath), "-fanart.jpg");

            // Check if the thumbnail exists
            fs.exists(fanartPath, function (exists) {
                if (exists) {
                    // If the thumbnail exists, simply pipe that to the client
                    fs.createReadStream(fanartpath).pipe(res)
                }
            });
        });
    });

    // Endpoint to retrieve episode details based on the local movie ID
    server.get('/movie/:id/info', requiresAuth, function (req, res, next) {
        // search for attributes
        databases.movie.findById(req.params.id, {include: [databases.file]}).then(movie => {
            movie = movie.toJSON();

            if (UserManager.hasSavedMovieProgress(req.authorization.jwt.username, movie.id))
                movie.watchTime = UserManager.getSavedMovieProgress(req.authorization.jwt.username, movie.id).time;

            res.send(movie);
        })
    });

    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/movie/:id/play', function (req, res, next) {
        // search for attributes
        databases.movie.findById(req.params.id, {include: [databases.file]}).then(episode => {
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

};