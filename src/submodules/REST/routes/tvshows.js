import path from 'path';
import { promises as fs } from 'fs';
import { Op } from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth';
import errors from '../errors';

import { Series } from '../../../models/series';
import { Episode } from '../../../models/episode';
import { TrackEpisode } from '../../../models/trackEpisode';
import { SeriesSet } from '../../../models/seriesSet';

export default (server, oblecto) => {
    server.get('/series/list/:sorting', authMiddleWare.requiresAuth, async function (req, res) {
        const limit = parseInt(req.query.count) || 20;
        const page = parseInt(req.query.page) || 0;

        if (!Number.isInteger(limit) || !Number.isInteger(page))
            throw new errors.BadRequestError('Limit or Page must be a number');

        let AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.query.order.toLowerCase()) === -1)
            throw new errors.BadRequestError('Sorting order is invalid');

        if (!(req.params.sorting in Series.rawAttributes))
            throw new errors.BadRequestError('Sorting method is invalid');

        let results = await Series.findAll({
            order: [[req.params.sorting, req.query.order]],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/series/sets', authMiddleWare.requiresAuth, async function (req, res) {
        let results = await SeriesSet.findAll({});
        res.send(results);
    });

    server.get('/series/set/:id', authMiddleWare.requiresAuth, async function (req, res) {
        const limit = parseInt(req.query.count) || 20;
        const page = parseInt(req.query.page) || 0;

        let results = await SeriesSet.findAll({
            include: [{ model: Series }],
            where: { id: req.params.id },
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/series/:id/sets', authMiddleWare.requiresAuth, async function (req, res) {
        let sets = await Series.findByPk(req.params.id, {
            attributes: [],
            include: [{ model: SeriesSet }]
        });
        res.send(sets ? sets.SeriesSets : []);
    });

    server.put('/series/:id/sets', authMiddleWare.requiresAuth, async function (req, res) {
        try {
            let series = await Series.findByPk(req.params.id);
            let set = await SeriesSet.findByPk(req.body.setId);

            if (!series || !set) throw new Error('Not found');
            await set.addSeries(series);
            res.send({ success: true });
        } catch (e) {
             throw new errors.NotFoundError('Series or set could not be found');
        }
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
        let show = await Series.findByPk(req.params.id);

        let imagePath = oblecto.artworkUtils.seriesPosterPath(show, req.combined_params.size || 'medium');

        res.sendFile(imagePath);
    });

    server.put('/series/:id/poster', authMiddleWare.requiresAuth, async function (req, res) {
        let show = await Series.findByPk(req.params.id);

        if (!show) {
            throw new errors.NotFoundError('Movie does not exist');
        }

        let posterPath = path.normalize(oblecto.config.assets.showPosterLocation) + '/' + show.id + '.jpg';

        if (oblecto.config.assets.storeWithFile) {
            let showPath = show.directory;

            posterPath = path.join(showPath, show.seriesName + '-poster.jpg');
        }

        if (!req.files || Object.keys(req.files).length === 0) {
            throw new errors.MissingParameterError('Image file is missing');
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            let image = await sharp(uploadPath);
            let metadata = await image.metadata();
            let ratio = metadata.height / metadata.width;

            if (ratio < 1 || ratio > 2) {
                throw new errors.UnprocessableEntityError('Image aspect ratio is incorrect');
            }

        } catch (e) {
            if (e instanceof errors.UnprocessableEntityError) throw e;
            throw new errors.UnprocessableEntityError('File is not an image');
        }

        try {
            await fs.copyFile(uploadPath, posterPath);
            res.send(['success']);
        } catch (e) {
            throw new errors.InternalServerError('An error has occurred during upload of poster');
        }
    });

    server.get('/shows/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        let series = await Series.findAll({ where: { seriesName: { [Op.like]: '%' + req.params.name + '%' } } });

        res.send(series);

    });
};
