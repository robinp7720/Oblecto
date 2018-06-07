import path from 'path';
import jwt from 'jsonwebtoken';
import fs from 'fs';

import tvdb from '../../../submodules/tvdb';
import databases from '../../../submodules/database';
import config from '../../../config';
import TVShowIndexer from '../../../lib/indexers/tv/index';
import authMiddleWare from '../middleware/auth';

export default (server) => {

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
        let show = await databases.tvshow.findById(req.params.id);

        show.genre = JSON.parse(show.genre);
        res.send(show);
    });

    // Endpoint to request a re-index of a series based on the local ID
    server.get('/series/:id/index', authMiddleWare.requiresAuth, function (req, res, next) {
        databases.tvshow.findById(req.params.id).then(show => {
            TVShowIndexer.indexDirectory(show.directory);

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
        databases.tvshow.findById(req.params.id).then(show => {
            if (!show) {
                res.errorCode = 404;
                return res.send();
            }

            let showPath = show.directory;
            let posterPath = path.join(showPath, show.seriesName + '-poster.jpg');

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

};