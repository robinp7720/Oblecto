import jwt from "jsonwebtoken";
import path from 'path';
import fs from 'fs';

import config from "../../../config";
import databases from "../../../submodules/database";
import tvdb from "../../tvdb";

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
            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            let posterPath = moviePath.replace(path.extname(moviePath), "-poster.jpg");

            // Check if the thumbnail exists
            fs.exists(posterPath, function (exists) {
                if (exists) {
                    // If the thumbnail exists, simply pipe that to the client
                    fs.createReadStream(posterPath).pipe(res)
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

};