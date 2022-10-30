import { promises as fs } from 'fs';
import errors from 'restify-errors';
import sequelize from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth';

import { TrackMovie } from '../../../models/trackMovie';
import { File } from '../../../models/file';
import { Movie } from '../../../models/movie';
import { MovieSet } from '../../../models/movieSet';

const Op = sequelize.Op;

/**
 * @param {Server} server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
    server.get('/movies/list/:sorting', authMiddleWare.requiresAuth, async function (req, res) {
        let limit = 20;
        let page = 0;

        let AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.params.order.toLowerCase()) === -1)
            return new errors.BadRequestError('Sorting order is invalid');

        if (!(req.params.sorting in Movie.rawAttributes))
            return new errors.BadRequestError('Sorting method is invalid');

        if (req.params.count && Number.isInteger(req.params.count))
            limit = parseInt(req.params.count);

        if (req.params.page && Number.isInteger(req.params.page))
            page = parseInt(req.params.page);

        let results = await Movie.findAll({
            include: [
                {
                    model: TrackMovie,
                    required: false,
                    where: { userId: req.authorization.user.id }
                }
            ],
            order: [[req.params.sorting, req.params.order]],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/movies/sets', authMiddleWare.requiresAuth, async function (req, res) {
        let results = await MovieSet.findAll({});

        res.send(results);
    });

    server.get('/movies/set/:id', authMiddleWare.requiresAuth, async function (req, res) {
        let limit = req.params.count || 20;
        let page = req.params.page || 0;

        if (!Number.isInteger(limit) || !Number.isInteger(page))
            return new errors.BadRequestError('Limit or Page must be a number');

        let AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.params.order.toLowerCase()) === -1)
            return new errors.BadRequestError('Sorting order is invalid');

        let results = await MovieSet.findAll({
            include: [
                {
                    model: Movie,
                    include: [
                        {
                            model: TrackMovie,
                            required: false,
                            where: { userId: req.authorization.user.id }
                        }
                    ]
                },
            ],
            where: { id: req.params.id },
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/movie/:id/poster', async function (req, res) {
        let movie = await Movie.findByPk(req.params.id);

        const path = oblecto.artworkUtils.moviePosterPath(movie, req.params.size || 'medium');

        res.sendRaw(await fs.readFile(path));
    });

    server.put('/movie/:id/poster', authMiddleWare.requiresAuth, async function (req, res) {
        let movie = await Movie.findByPk(req.params.id, { include: [File] });

        if (!movie) {
            return new errors.NotFoundError('Movie does not exist');
        }

        let posterPath = oblecto.artworkUtils.moviePosterPath(movie);

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

        fs.copyFile(uploadPath, posterPath, (err) => {
            if (err) throw err;

            for (let size of Object.keys(oblecto.config.artwork.poster)) {
                oblecto.queue.pushJob('rescaleImage', {
                    from: oblecto.artworkUtils.moviePosterPath(movie),
                    to: oblecto.artworkUtils.moviePosterPath(movie, size),
                    width: oblecto.config.artwork.poster[size]
                });
            }

            res.send(['success']);
        });

    });

    server.get('/movie/:id/fanart', async function (req, res) {
        let movie = await Movie.findByPk(req.params.id);

        const path = oblecto.artworkUtils.movieFanartPath(movie, req.params.size || 'large');

        res.sendRaw(await fs.readFile(path));
    });

    server.put('/movie/:id/fanart', authMiddleWare.requiresAuth, async function (req, res) {
        let movie = await Movie.findByPk(req.params.id, { include: [File] });

        if (!movie) {
            return new errors.NotFoundError('Movie does not exist');
        }

        let fanartPath = oblecto.artworkUtils.movieFanartPath(movie);

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

        fs.copyFile(uploadPath, fanartPath, (err) => {
            if (err) throw err;

            for (let size of Object.keys(oblecto.config.artwork.poster)) {
                oblecto.queue.pushJob('rescaleImage', {
                    from: oblecto.artworkUtils.movieFanartPath(movie),
                    to: oblecto.artworkUtils.movieFanartPath(movie, size),
                    width: oblecto.config.artwork.poster[size]
                });
            }

            res.send(['success']);
        });

    });

    server.get('/movie/:id/info', authMiddleWare.requiresAuth, async function (req, res) {
        let movie = await Movie.findByPk(req.params.id, {
            include: [
                File,
                {
                    model: TrackMovie,
                    required: false,
                    where: { userId: req.authorization.user.id }
                }
            ]
        });

        res.send(movie);
    });

    server.get('/movie/:id/play', async function (req, res) {
        let movie = await Movie.findByPk(req.params.id, { include: [{ model: File }] });

        let file = movie.files[0];

        res.redirect(`/stream/${file.id}`);
    });

    server.get('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req, res) {
        let sets = await Movie.findByPk(req.params.id, {
            attributes: [],
            include: [
                {
                    model: MovieSet,
                    include: [
                        {
                            model: Movie,
                            include: [
                                {
                                    model: TrackMovie,
                                    required: false,
                                    where: { userId: req.authorization.user.id }
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        res.send(sets.movieSets);
    });

    server.put('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req, res) {
        try {
            let [movie] = await Movie.findByPk(req.params.id);
            let [set] = await MovieSet.findByPk(req.params.setId);

            set.addMovie(movie);
        } catch (e) {
            return new errors.NotFoundError('Movie or set could not be found');
        }
    });

    server.get('/movies/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let movie = await Movie.findAll({
            where: { movieName: { [Op.like]: '%' + req.params.name + '%' } },
            include: [File]
        });

        res.send(movie);

    });

    server.get('/movies/watching', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let tracks = await TrackMovie.findAll({
            include: [
                {
                    model: Movie,
                    required: true,
                    include: [
                        {
                            model: TrackMovie,
                            required: false,
                            where: { userId: req.authorization.user.id }
                        }
                    ]
                }
            ],
            where: {
                userId: req.authorization.user.id,
                progress: { [sequelize.Op.lt]: 0.9 },
                updatedAt: { [sequelize.Op.gt]: new Date() - (1000*60*60*24*7) }
            },
            order: [['updatedAt', 'DESC'],],
        });

        // We are only interested in the episode objects, so extract all the episode object from
        // each track object and send the final mapped array to the client
        res.send(tracks.map((track) => {
            return track.Movie;
        }));
    });
};
