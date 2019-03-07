import path from 'path';
import fs from 'fs';
import errors from 'restify-errors';

import databases from '../../../submodules/database';
import UserManager from '../../users';
import authMiddleWare from '../middleware/auth';

import config from '../../../config.js';
import sequelize from 'sequelize';

const Op = sequelize.Op;

export default (server) => {

    // Endpoint to get a list of episodes from all series
    server.get('/movies/list/:sorting/:order', authMiddleWare.requiresAuth, async function (req, res) {
        let results = await databases.movie.findAll({
            include: [
                {
                    model: databases.trackMovies,
                    required: false,
                    where: {
                        userId: req.authorization.jwt.id
                    }
                }
            ],
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 100
        });

        res.send(results);
    });



    // Endpoint to get a poster based on localId
    server.get('/movie/:id/poster', async function (req, res, next) {
        // Get episode data
        let movie = await databases.movie.findById(req.params.id, {
            include: [databases.file]
        });

        let posterPath = path.normalize(config.assets.moviePosterLocation) + '/' + movie.id + '.jpg';



        if (config.assets.storeWithFile) {
            if (!movie.files[0])
                return next(new errors.NotFoundError('Movie does not exist'));

            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            posterPath = moviePath.replace(path.extname(moviePath), '-poster.jpg');
        }

        // Check if the thumbnail exists
        fs.exists(posterPath, function (exists) {
            if (!exists)
                return next(new errors.NotFoundError('Poster for movie does not exist'));

            // If the thumbnail exists, simply pipe that to the client
            fs.createReadStream(posterPath).pipe(res);

        });

    });

    // Endpoint to get a fanart based on localId
    server.get('/movie/:id/fanart', async function (req, res, next) {
        // Get episode data
        let movie = await databases.movie.findById(req.params.id, {
            include: [databases.file]
        });

        let fanartPath = path.normalize(config.assets.movieFanartLocation) + '/' + movie.id + '.jpg';

        if (config.assets.storeWithFile) {
            if (!movie.files[0])
                return next(new errors.NotFoundError('Movie does not exist'));

            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            fanartPath = moviePath.replace(path.extname(moviePath), '-fanart.jpg');
        }

        // Check if the thumbnail exists
        fs.exists(fanartPath, function (exists) {
            if (exists) {
                // If the thumbnail exists, simply pipe that to the client
                fs.createReadStream(fanartPath).pipe(res);
            }
        });

    });

    // Endpoint to retrieve episode details based on the local movie ID
    server.get('/movie/:id/info', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let movie = await databases.movie.findById(req.params.id, {
            include: [databases.file]
        });

        movie = movie.toJSON();

        if (UserManager.hasSavedMovieProgress(req.authorization.jwt.username, movie.id))
            movie.watchTime = UserManager.getSavedMovieProgress(req.authorization.jwt.username, movie.id).time;

        res.send(movie);

    });

    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/movie/:id/play', async function (req, res, next) {
        // search for attributes
        let movie = await databases.movie.findById(req.params.id, {
            include: [
                {
                    model: databases.file,
                    where: {
                        [Op.not]: {
                            extension: 'iso'
                        }
                    }
                }
            ]
        });

        let file = movie.files[0];

        res.redirect(`/stream/${file.id}`, next);
    });

    // Endpoint for text based searching of the movie database
    server.get('/movies/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let movie = await databases.movie.findAll({
            where: {
                movieName: {
                    [Op.like]: "%" + req.params.name + "%"
                }
            },
            include: [databases.file]
        });

        res.send(movie);

    });

};