import path from 'path';
import fs from 'fs';
import sequelize from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth';
import errors from 'restify-errors';

import { Series } from '../../../models/series';
import { Episode } from '../../../models/episode';
import { TrackEpisode } from '../../../models/trackEpisode';

const Op = sequelize.Op;

export default (server, oblecto) => {
    server.get('/series/list/:sorting', authMiddleWare.requiresAuth, async function (req, res) {
        const limit = parseInt(req.query.count) || 20;
        const page = parseInt(req.query.page) || 0;

        if (!Number.isInteger(limit) || !Number.isInteger(page))
            return new errors.BadRequestError('Limit or Page must be a number');

        let AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.query.order.toLowerCase()) === -1)
            return new errors.BadRequestError('Sorting order is invalid');

        if (!(req.params.sorting in Series.rawAttributes))
            return new errors.BadRequestError('Sorting method is invalid');

        let results = await Series.findAll({
            order: [[req.params.sorting, req.query.order]],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/series/:id/info', authMiddleWare.requiresAuth, async function (req, res) {
        let show = await Series.findByPk(req.params.id);

        if (show.genre) show.genre = JSON.parse(show.genre);

        res.send(show);
    });

    // Endpoint to get all episodes within a series
    server.get('/series/:id/episodes', authMiddleWare.requiresAuth, async function (req, res) {
        let show = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization.user.id }
                }
            ],
            where: { SeriesId: req.params.id },
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC']
            ]
        });

        res.send(show);
    });

    server.get('/series/:id/poster', async function (req, res) {
        let show;

        try {
            show = await Series.findByPk(req.params.id);
        } catch(e) {
            return new errors.NotFoundError('Series does not exist');
        }

        let imagePath = oblecto.artworkUtils.seriesPosterPath(show, req.params.size || 'medium');

        fs.createReadStream(imagePath)
            .on('error', ()  => {
                return new errors.NotFoundError('No poster found');
            })
            .pipe(res);
    });

    server.put('/series/:id/poster', authMiddleWare.requiresAuth, async function (req, res) {
        let show = await Series.findByPk(req.params.id);

        if (!show) {
            return new errors.NotFoundError('Movie does not exist');
        }

        let posterPath = path.normalize(oblecto.config.assets.showPosterLocation) + '/' + show.id + '.jpg';

        if (oblecto.config.assets.storeWithFile) {
            let showPath = show.directory;

            posterPath = path.join(showPath, show.seriesName + '-poster.jpg');
        }

        if (req.files.length < 1) {
            return new errors.MissingParameterError('Image file is missing');
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            let image = await sharp(uploadPath);
            let metadata = await image.metadata();
            let ratio = metadata.height / metadata.width;

            if (!(1 <= ratio <= 2)) {
                return new errors.InvalidContentError('Image aspect ratio is incorrect');
            }

        } catch (e) {
            return new errors.InvalidContentError('File is not an image');
        }

        try {
            fs.copyFile(uploadPath, posterPath, (err) => {
                if (err) throw err;

                res.send(['success']);
            });
        } catch (e) {
            return new errors.InternalError('An error has occurred during upload of poster');
        }
    });

    server.get('/shows/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        let series = await Series.findAll({ where: { seriesName: { [Op.like]: '%' + req.params.name + '%' } } });

        res.send(series);

    });
};
