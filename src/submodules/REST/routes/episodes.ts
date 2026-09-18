import { Op, and, col, fn, where } from 'sequelize';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/restrict-plus-operands, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars */
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';

import authMiddleWare from '../middleware/auth.js';
import { Episode } from '../../../models/episode.js';
import { Series } from '../../../models/series.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { File } from '../../../models/file.js';
import { Stream } from '../../../models/stream.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';
import { saveArtwork } from '../../../lib/artwork/ArtworkUpload.js';
import { firstUpload } from '../../../lib/users/avatars.js';
import upload from '../middleware/upload.js';

export default (server: Express, oblecto: Oblecto) => {
    // Endpoint to get a list of episodes from all series
    server.get('/episodes/list/:sorting', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        let limit = 20;
        let page = 0;

        const combined_params = req.combined_params!;
        const AllowedOrders = ['desc', 'asc'];

        const order = String(combined_params.order ?? '').toLowerCase();

        if (AllowedOrders.indexOf(order) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

        if (!(String(req.params.sorting) in Episode.rawAttributes))
            return res.status(400).send({ message: 'Sorting method is invalid' });

        if (combined_params.count && Number.isInteger(parseInt(combined_params.count as string)))
            limit = parseInt(combined_params.count as string);

        if (combined_params.page && Number.isInteger(parseInt(combined_params.page as string)))
            page = parseInt(combined_params.page as string);

        const results = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization!.user.id }
                }
            ],
            order: [[String(req.params.sorting), order]],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    // Endpoint to get a banner image for an episode based on the local episode ID
    server.get('/episode/:id/banner', async function (req: OblectoRequest, res: Response) {
        const episode = await Episode.findByPk(req.params.id as string, { include: [File] });

        if (!episode) return res.status(404).send({ message: 'Episode does not exist' });

        const imagePath = oblecto.artworkUtils.episodeBannerPath(episode, (req.combined_params?.size as string) || 'medium');

        res.sendFile(imagePath);
    });

    server.put('/episode/:id/banner', authMiddleWare.requiresPermission('libraries.manage'), upload, async function (req: OblectoRequest, res: Response) {
        const episode = await Episode.findByPk(req.params.id as string, { include: [File] });

        if (!episode) {
            return res.status(404).send({ message: 'Episode does not exist' });
        }

        await saveArtwork(oblecto, firstUpload(req.files), 'banner', size => oblecto.artworkUtils.episodeBannerPath(episode, size));

        res.send(['success']);
    });

    // Endpoint to list all stored files for the specific episode
    server.get('/episode/:id/files', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const episode: any = await Episode.findByPk(req.params.id as string, { include: [File] });

        res.send(episode.Files);
    });

    // Endpoint to retrieve episode details based on the local episode ID
    server.get('/episode/:id/info', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        // search for attributes

        const episode = await Episode.findByPk(req.params.id as string, {
            include: [
                {
                    model: File,
                    include: [Stream]
                },
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization!.user.id },
                }
            ]
        });

        res.send(episode);
    });

    // Endpoint to retrieve the episode next in series based on the local episode ID
    server.get('/episode/:id/next', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        // search for attributes
        const results = await Episode.findByPk(req.params.id as string);

        if (!results) {
            res.status(404).send({ message: 'Episode not found' });
            return;
        }
        const episode = await Episode.findOne({
            where: {
                SeriesId: results.SeriesId,
                [Op.or]: [
                    {
                        [Op.and]: [
                            { airedEpisodeNumber: { [Op.gt]: results.airedEpisodeNumber } },
                            { airedSeason: { [Op.gte]: results.airedSeason } },
                        ]
                    },
                    { [Op.and]: [{ airedSeason: { [Op.gt]: results.airedSeason } },] }
                ]
            },
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC'],
            ]
        });

        res.send(episode);

    });

    server.get('/episodes/search/:name', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        // search for attributes
        const episode = await Episode.findAll({
            where: { episodeName: { [Op.like]: '%' + req.params.name + '%' } },
            include: [
                File,
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization!.user.id }
                }
            ]
        });

        res.send(episode);

    });

    // Endpoint to get the episodes currently being watched
    server.get('/episodes/watching', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        // search for attributes
        const watching = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: true,
                    where: {
                        userId: req.authorization!.user.id,
                        progress: { [Op.lt]: 0.9 },
                        updatedAt: { [Op.gt]: new Date(Date.now() - (1000*60*60*24*7)) }
                    },
                }
            ],
            order: [['updatedAt', 'DESC'],],
        });

        res.send(watching);
    });

    server.get('/episodes/next', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        // Next episodes currently doesn't work on sqlite as the LPAD function doesn't exist
        // Todo: Fix next episodes endpoint to support sqlite
        if (oblecto.config.database.dialect === 'sqlite')
            return res.status(501).send({ message: 'Next episode is not supported when using sqlite (yet)' });

        // search for attributes
        const latestWatched = await Episode.findAll({
            attributes: {
                include: [
                    [fn('MAX', col('absoluteNumber')), 'absoluteNumber'],
                    [fn('MAX', fn('concat', fn('LPAD', col('airedSeason'), 2, '0'), fn('LPAD', col('airedEpisodeNumber'), 2, '0'))), 'seasonepisode'],
                    [fn('MAX', col('firstAired')), 'firstAired']
                ]
            },
            include: [
                {
                    model: TrackEpisode,
                    required: true,
                    where: {
                        userId: req.authorization!.user.id,
                        progress: { [Op.gt]: 0.9 },
                        updatedAt: { [Op.gt]: new Date(Date.now() - (1000*60*60*24*7)) }
                    },
                }
            ],
            group: ['SeriesId']
        });

        const nextUp = [];

        for (const latest of latestWatched) {
            const latestData: any = latest.toJSON();
            const next = await Episode.findOne({
                attributes: { include: [[fn('concat', fn('LPAD', col('airedSeason'), 2, '0'), fn('LPAD', col('airedEpisodeNumber'), 2, '0')), 'seasonepisode']] },
                include: [
                    Series,
                    {
                        model: TrackEpisode,
                        where: { userId: req.authorization!.user.id },
                        required: false
                    }
                ],
                where: and(
                    where(col('SeriesId'), '=', latestData.SeriesId),
                    where(fn('concat', fn('LPAD', col('airedSeason'), 2, '0'), fn('LPAD', col('airedEpisodeNumber'), 2, '0')), '>', latestData.seasonepisode),
                ),
                order: [col('seasonepisode')]
            });

            if (next) {
                nextUp.push(next);
            }
        }

        res.send(nextUp);

    });

};
