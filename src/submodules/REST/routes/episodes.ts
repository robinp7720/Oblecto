import { Op, and, col, fn, where } from 'sequelize';
import { promises as fs } from 'fs';
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth.js';
import { Episode } from '../../../models/episode.js';
import { Series } from '../../../models/series.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { File } from '../../../models/file.js';

export default (server: Express, oblecto: any) => {
    // Endpoint to get a list of episodes from all series
    server.get('/episodes/list/:sorting', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let limit = 20;
        let page = 0;

        const AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.combined_params.order.toLowerCase()) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

        if (!(req.params.sorting in Episode.rawAttributes))
            return res.status(400).send({ message: 'Sorting method is invalid' });

        if (req.combined_params.count && Number.isInteger(parseInt(req.combined_params.count)))
            limit = parseInt(req.combined_params.count);

        if (req.combined_params.page && Number.isInteger(parseInt(req.combined_params.page)))
            page = parseInt(req.combined_params.page);

        const results = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization.user.id }
                }
            ],
            order: [[req.params.sorting, req.combined_params.order]],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    // Endpoint to get a banner image for an episode based on the local episode ID
    server.get('/episode/:id/banner', async function (req: any, res: Response) {
        const episode = await Episode.findByPk(req.params.id as string, { include: [File] });

        const imagePath = oblecto.artworkUtils.episodeBannerPath(episode, req.combined_params.size || 'medium');

        res.sendFile(imagePath);
    });

    server.put('/episode/:id/banner', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        const episode = await Episode.findByPk(req.params.id as string, { include: [File] });

        if (!episode) {
            return res.status(404).send({ message: 'Episode does not exist' });
        }

        const thumbnailPath = oblecto.artworkUtils.episodeBannerPath(episode);

        if (!req.files || Object.keys(req.files).length < 1) {
            return res.status(400).send({ message: 'Image file is missing' });
        }

        const uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            const image = await sharp(uploadPath);
            const metadata = await image.metadata();
            const ratio = (metadata.height || 0) / (metadata.width || 1);

            if ( !(1 <= ratio && ratio <= 2)) {
                return res.status(422).send({ message: 'Image aspect ratio is incorrect' });
            }

        } catch (e) {
            return res.status(422).send({ message: 'File is not an image' });
        }

        try {
            await fs.copyFile(uploadPath, thumbnailPath);
            
            for (const size of Object.keys(oblecto.config.artwork.poster)) {
                oblecto.queue.pushJob('rescaleImage', {
                    from: oblecto.artworkUtils.episodeBannerPath(episode),
                    to: oblecto.artworkUtils.episodeBannerPath(episode, size),
                    width: oblecto.config.artwork.poster[size]
                });
            }

            res.send(['success']);
        } catch (e) {
            console.log(e);
            return res.status(500).send({ message: 'An error has occured during upload of banner' });
        }
    });

    // Endpoint to list all stored files for the specific episode
    server.get('/episode/:id/files', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const episode: any = await Episode.findByPk(req.params.id as string, { include: [File] });

        res.send(episode.Files);
    });

    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/episode/:id/play', async function (req: Request, res: Response) {
        // search for attributes
        const episode: any = await Episode.findByPk(req.params.id as string, { include: [File] });

        if (!episode || !episode.Files || episode.Files.length === 0) {
            res.status(404).send({ message: 'No files found for this episode' });
            return;
        }

        const file = episode.Files[0];

        res.redirect(`/stream/${file.id}`);

    });

    // Endpoint to retrieve episode details based on the local episode ID
    server.get('/episode/:id/info', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        // search for attributes

        const episode = await Episode.findByPk(req.params.id as string, {
            include: [
                File,
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization.user.id },
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

    server.get('/episodes/search/:name', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        // search for attributes
        const episode = await Episode.findAll({
            where: { episodeName: { [Op.like]: '%' + req.params.name + '%' } },
            include: [
                File,
                Series,
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization.user.id }
                }
            ]
        });

        res.send(episode);

    });

    // Endpoint to get the episodes currently being watched
    server.get('/episodes/watching', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        // search for attributes
        const watching = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: true,
                    where: {
                        userId: req.authorization.user.id,
                        progress: { [Op.lt]: 0.9 },
                        updatedAt: { [Op.gt]: new Date(Date.now() - (1000*60*60*24*7)) }
                    },
                }
            ],
            order: [['updatedAt', 'DESC'],],
        });

        res.send(watching);
    });

    server.get('/episodes/next', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
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
                        userId: req.authorization.user.id,
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
                        where: { userId: req.authorization.user.id },
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
