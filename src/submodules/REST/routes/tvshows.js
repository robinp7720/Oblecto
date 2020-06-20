import path from 'path';
import fs from 'fs';
import sequelize from 'sequelize';

import databases from '../../../submodules/database';
import SeriesCollector from '../../../lib/indexers/series/SeriesCollector';
import authMiddleWare from '../middleware/auth';
import errors from "restify-errors";
import jimp from 'jimp';

const Op = sequelize.Op;

export default (server, oblecto) => {

    server.get('/shows/list/:sorting/:order', authMiddleWare.requiresAuth, async function (req, res, next) {
        let tvShows = await databases.tvshow.findAll({
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 30
        });

        res.send(tvShows);
    });

    // Endpoint to request info based on the local series ID
    server.get('/series/:id/info', authMiddleWare.requiresAuth, async function (req, res, next) {
        let show = await databases.tvshow.findByPk(req.params.id);

        if (show.genre)
            show.genre = JSON.parse(show.genre);

        res.send(show);
    });

    // Endpoint to request a re-index of a series based on the local ID
    server.get('/series/:id/index', authMiddleWare.requiresAuth, function (req, res, next) {
        databases.tvshow.findByPk(req.params.id).then(show => {
            SeriesCollector.CollectDirectory(show.directory);

            res.send([true]);
        });
    });

    // Endpoint to get all episodes within a series
    server.get('/series/:id/episodes', authMiddleWare.requiresAuth, function (req, res, next) {
        // search for attributes
        databases.episode.findAll({
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
            where: {tvshowId: req.params.id},
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC']
            ],
        }).then(show => {
            res.send(show);
        });
    });

    // Endpoint to get the poster for a series
    server.get('/series/:id/poster', function (req, res, next) {
        databases.tvshow.findByPk(req.params.id).then(show => {
            if (!show) {
                res.errorCode = 404;
                return res.send();
            }

            let posterPath = path.normalize(oblecto.config.assets.showPosterLocation) + '/' + show.id + '.jpg';

            if (oblecto.config.assets.storeWithFile) {
                let showPath = show.directory;
                posterPath = path.join(showPath, show.seriesName + '-poster.jpg');
            }

            // Check if the poster image already exits
            fs.exists(posterPath, function (exists) {
                if (exists) {
                    // If the image exits, simply pipe it to the client
                    fs.createReadStream(posterPath).pipe(res);
                } else {
                    res.errorCode = 404;
                    res.send();
                }
            });
        });
    });

    server.put('/series/:id/poster', async function (req, res, next) {
        let show = await databases.tvshow.findByPk(req.params.id);

        if (!show) {
            return next(new errors.NotFoundError('Movie does not exist'));
        }

        let posterPath = path.normalize(oblecto.config.assets.showPosterLocation) + '/' + show.id + '.jpg';

        if (oblecto.config.assets.storeWithFile) {
            let showPath = show.directory;
            posterPath = path.join(showPath, show.seriesName + '-poster.jpg');
        }

        if (req.files.length < 1) {
            return next(new errors.MissingParameter('Image file is missing'));
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path

        try {
            let image = await jimp.read(uploadPath);

            let ratio = image.bitmap.height / image.bitmap.width

            if ( !(1 <= ratio <= 2)) {
                return next(new errors.InvalidContent('Image aspect ratio is incorrect'));
            }

        } catch (e) {
            return next(new errors.InvalidContent('File is not an image'));
        }

        try {
            fs.copyFile(uploadPath, posterPath, (err) => {
                if (err) throw err;

                res.send(['success']);
            });
        } catch (e) {
            console.log(e);

            return next(new errors.Internal('An error has occured during upload of poster'));
        }

        next();
    });


    server.get('/shows/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let tvshows = await databases.tvshow.findAll({
            where: {
                seriesName: {
                    [Op.like]: '%' + req.params.name + '%'
                }
            }
        });

        res.send(tvshows);

    });
};
