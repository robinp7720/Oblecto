import path from 'path';
import { promises as fs } from 'fs';
import { Express, Request, Response } from 'express';
import { Op } from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth.js';
import errors from '../errors.js';

import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { SeriesSet } from '../../../models/seriesSet.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';

export default (server: Express, oblecto: Oblecto) => {
    server.get('/series/list/:sorting', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params!;
        const limit = parseInt(params.count as string) || 20;
        const page = parseInt(params.page as string) || 0;

        const AllowedOrders = ['desc', 'asc'];

        if (params.order && AllowedOrders.indexOf((params.order as string).toLowerCase()) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

        if (!(req.params.sorting in Series.rawAttributes))
            return res.status(400).send({ message: 'Sorting method is invalid' });

        const results = await Series.findAll({
            order: [[req.params.sorting, (params.order as string) || 'asc']],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/series/sets', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const results = await SeriesSet.findAll({});

        res.send(results);
    });

    server.get('/series/set/:id', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params!;
        const limit = parseInt(params.count as string) || 20;
        const page = parseInt(params.page as string) || 0;

        const results = await SeriesSet.findAll({
            include: [{ model: Series }],
            where: { id: req.params.id },
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/series/:id/sets', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const series: any = await Series.findByPk(req.params.id as string, {
            attributes: [],
            include: [{ model: SeriesSet }]
        });

        res.send(series ? series.SeriesSets : []);
    });

    server.put('/series/:id/sets', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        try {
            const series = await Series.findByPk(req.params.id as string);
            const set = await SeriesSet.findByPk(req.body.setId);

            if (!series || !set) return res.status(404).send({ message: 'Series or set not found' });
            await set.addSeries(series);
            res.send({ success: true });
        } catch (e) {
            return res.status(500).send({ message: 'Error adding series to set' });
        }
    });

    server.get('/series/:id/info', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const show = await Series.findByPk(req.params.id as string);

        if (!show) return res.status(404).send({ message: 'Series not found' });

        const data: any = show.toJSON();

        if (data.genre) data.genre = JSON.parse(data.genre);

        res.send(data);
    });

    // Endpoint to get all episodes within a series
    server.get('/series/:id/episodes', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const show = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization!.user.id }
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

    server.get('/series/:id/poster', async function (req: OblectoRequest, res: Response) {
        const show = await Series.findByPk(req.params.id as string);

        if (!show) return res.status(404).send({ message: 'Series not found' });

        const imagePath = oblecto.artworkUtils.seriesPosterPath(show, (req.combined_params?.size as string) || 'medium');

        res.sendFile(imagePath);
    });

    server.put('/series/:id/poster', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const show = await Series.findByPk(req.params.id as string);

        if (!show) {
            return res.status(404).send({ message: 'Series does not exist' });
        }

        let posterPath = path.normalize(oblecto.config.assets.showPosterLocation) + '/' + show.id + '.jpg';

        if (oblecto.config.assets.storeWithFile) {
            const showPath = show.directory;

            if (showPath) {
                posterPath = path.join(showPath, (show.seriesName || show.id.toString()) + '-poster.jpg');
            }
        }

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send({ message: 'Image file is missing' });
        }

        const uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            const image = await sharp(uploadPath);
            const metadata = await image.metadata();
            const ratio = (metadata.height || 0) / (metadata.width || 1);

            if (ratio < 1 || ratio > 2) {
                return res.status(422).send({ message: 'Image aspect ratio is incorrect' });
            }

        } catch (e) {
            return res.status(422).send({ message: 'File is not an image' });
        }

        try {
            await fs.copyFile(uploadPath, posterPath);
            res.send(['success']);
        } catch (e) {
            return res.status(500).send({ message: 'An error has occurred during upload of poster' });
        }
    });

    server.get('/shows/search/:name', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const series = await Series.findAll({ where: { seriesName: { [Op.like]: '%' + req.params.name + '%' } } });

        res.send(series);
    });
};