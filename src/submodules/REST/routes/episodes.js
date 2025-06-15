import sequelize from 'sequelize';
import { promises as fs } from 'fs';
import errors from '../errors';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth';
import { Episode } from '../../../models/episode';
import { Series } from '../../../models/series';
import { TrackEpisode } from '../../../models/trackEpisode';
import { File } from '../../../models/file';

const Op = sequelize.Op;

export default (server, oblecto) => {
    // Endpoint to get a list of episodes from all series
    server.get('/episodes/list/:sorting', authMiddleWare.requiresAuth, async function (req, res) {
        let limit = 20;
        let page = 0;

        let AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.combined_params.order.toLowerCase()) === -1)
            return new errors.BadRequestError('Sorting order is invalid');

        if (!(req.params.sorting in Episode.rawAttributes))
            return new errors.BadRequestError('Sorting method is invalid');

        if (req.combined_params.count && Number.isInteger(req.combined_params.count))
            limit = parseInt(req.combined_params.count);

        if (req.combined_params.page && Number.isInteger(req.combined_params.page))
            page = parseInt(req.combined_params.page);

        let results = await Episode.findAll({
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
    server.get('/episode/:id/banner', async function (req, res) {
        let episode = await Episode.findByPk(req.params.id, { include: [File] });

        let imagePath = oblecto.artworkUtils.episodeBannerPath(episode, req.combined_params.size || 'medium');

        res.sendFile(imagePath);
    });

    server.put('/episode/:id/banner', authMiddleWare.requiresAuth, async function (req, res) {
        let episode = await Episode.findByPk(req.params.id, { include: [File] });

        if (!episode) {
            return new errors.NotFoundError('Episode does not exist');
        }

        let thumbnailPath = this.oblecto.artworkUtils.episodeBannerPath(episode);

        if (req.files.length < 1) {
            return new errors.MissingParameter('Image file is missing');
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            let image = await sharp(uploadPath);
            let metadata = await image.metadata();
            let ratio = metadata.height / metadata.width;

            if ( !(1 <= ratio <= 2)) {
                return new errors.InvalidContent('Image aspect ratio is incorrect');
            }

        } catch (e) {
            return new errors.InvalidContent('File is not an image');
        }

        try {
            fs.copyFile(uploadPath, thumbnailPath, (err) => {
                if (err) throw err;

                for (let size of Object.keys(this.oblecto.config.artwork.poster)) {
                    this.oblecto.queue.pushJob('rescaleImage', {
                        from: this.oblecto.artworkUtils.episodeBannerPath(episode),
                        to: this.oblecto.artworkUtils.episodeBannerPath(episode, size),
                        width: this.oblecto.config.artwork.poster[size]
                    });
                }

                res.send(['success']);
            });
        } catch (e) {
            console.log(e);

            return new errors.Internal('An error has occured during upload of banner');
        }
    });

    // Endpoint to list all stored files for the specific episode
    server.get('/episode/:id/files', authMiddleWare.requiresAuth, async function (req, res) {
        let episode = await Episode.findByPk(req.params.id, { include: [File] });

        res.send(episode.files);
    });

    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/episode/:id/play', async function (req, res) {
        // search for attributes
        let episode = await Episode.findByPk(req.params.id, { include: [File] });

        let file = episode.files[0];

        res.redirect(`/stream/${file.id}`);

    });

    // Endpoint to retrieve episode details based on the local episode ID
    server.get('/episode/:id/info', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes

        let episode = await Episode.findByPk(req.params.id, {
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
    server.get('/episode/:id/next', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let results = await Episode.findByPk(req.params.id);
        let episode = await Episode.findOne({
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

    server.get('/episodes/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let episode = await Episode.findAll({
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
    server.get('/episodes/watching', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let watching = await Episode.findAll({
            include: [
                Series,
                {
                    model: TrackEpisode,
                    required: true,
                    where: {
                        userId: req.authorization.user.id,
                        progress: { [sequelize.Op.lt]: 0.9 },
                        updatedAt: { [sequelize.Op.gt]: new Date() - (1000*60*60*24*7) }
                    },
                }
            ],
            order: [['updatedAt', 'DESC'],],
        });

        // We are only interested in the episode objects, so extract all the episode object from
        // each track object and send the final mapped array to the client
        res.send(watching);
    });

    server.get('/episodes/next', authMiddleWare.requiresAuth, async function (req, res) {
        // Next episodes currently doesn't work on sqlite as the LPAD function doesn't exist
        // Todo: Fix next episodes endpoint to support sqlite
        if (oblecto.config.database.dialect === 'sqlite')
            return new errors.NotImplementedError('Next episode is not supported when using sqlite (yet)');

        // search for attributes
        let latestWatched = await Episode.findAll({
            attributes: {
                include: [
                    [sequelize.fn('MAX', sequelize.col('absoluteNumber')), 'absoluteNumber'],
                    [sequelize.fn('MAX', sequelize.fn('concat', sequelize.fn('LPAD', sequelize.col('airedSeason'), 2, '0'), sequelize.fn('LPAD', sequelize.col('airedEpisodeNumber'), 2, '0'))), 'seasonepisode'],
                    [sequelize.fn('MAX', sequelize.col('firstAired')), 'firstAired']
                ]
            },
            include: [
                {
                    model: TrackEpisode,
                    required: true,
                    where: {
                        userId: req.authorization.user.id,
                        progress: { [sequelize.Op.gt]: 0.9 },
                        updatedAt: { [sequelize.Op.gt]: new Date() - (1000*60*60*24*7) }
                    },
                }
            ],
            group: ['SeriesId']
        });

        let nextUp = [];

        for (let latest of latestWatched) {
            latest = latest.toJSON();
            let next = await Episode.findOne({
                attributes: { include: [[sequelize.fn('concat', sequelize.fn('LPAD', sequelize.col('airedSeason'), 2, '0'), sequelize.fn('LPAD', sequelize.col('airedEpisodeNumber'), 2, '0')), 'seasonepisode']] },
                include: [
                    Series,
                    {
                        model: TrackEpisode,
                        where: { userId: req.authorization.user.id },
                    }
                ],
                where: sequelize.and(
                    sequelize.where(sequelize.col('SeriesId'), '=', latest.SeriesId),
                    sequelize.where(sequelize.fn('concat', sequelize.fn('LPAD', sequelize.col('airedSeason'), 2, '0'), sequelize.fn('LPAD', sequelize.col('airedEpisodeNumber'), 2, '0')), '>', latest.seasonepisode),
                ),
                order: [sequelize.col('seasonepisode')]
            });

            if (next) {
                nextUp.push(next);
            }
        }

        res.send(nextUp);

    });

};
