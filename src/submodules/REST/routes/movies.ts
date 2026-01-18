import { promises as fs } from 'fs';
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import { Op } from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth.js';

import { TrackMovie } from '../../../models/trackMovie.js';
import { File } from '../../../models/file.js';
import { Movie } from '../../../models/movie.js';
import { MovieSet } from '../../../models/movieSet.js';

export default (server: Express, oblecto: any) => {
    server.get('/movies/list/:sorting', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let limit = 20;
        let page = 0;

        let AllowedOrders = ['desc', 'asc'];

        if (AllowedOrders.indexOf(req.combined_params.order.toLowerCase()) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

        if (!(req.params.sorting in Movie.rawAttributes))
            return res.status(400).send({ message: 'Sorting method is invalid' });

        if (req.combined_params.count && Number.isInteger(parseInt(req.combined_params.count)))
            limit = parseInt(req.combined_params.count);

        if (req.combined_params.page && Number.isInteger(parseInt(req.combined_params.page)))
            page = parseInt(req.combined_params.page);

        let results = await Movie.findAll({
            include: [
                {
                    model: TrackMovie,
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

    server.get('/movies/sets', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        let results = await MovieSet.findAll({});
        res.send(results);
    });

    server.get('/movies/set/:id', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let limit = parseInt(req.combined_params.count) || 20;
        let page = parseInt(req.combined_params.page) || 0;

        let AllowedOrders = ['desc', 'asc'];
        if (req.combined_params.order && AllowedOrders.indexOf(req.combined_params.order.toLowerCase()) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

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

    server.get('/movie/:id/poster', async function (req: any, res: Response) {
        let movie = await Movie.findByPk(req.params.id as string);
        if (!movie) return res.status(404).send({ message: 'Movie not found' });

        const path = oblecto.artworkUtils.moviePosterPath(movie, req.combined_params.size || 'medium');
        res.sendFile(path);
    });

    server.put('/movie/:id/poster', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let movie = await Movie.findByPk(req.params.id as string, { include: [File] });

        if (!movie) {
            return res.status(404).send({ message: 'Movie does not exist' });
        }

        let posterPath = oblecto.artworkUtils.moviePosterPath(movie);

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send({ message: 'Image file is missing' });
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            let image = await sharp(uploadPath);
            let metadata = await image.metadata();
            let ratio = (metadata.height || 0) / (metadata.width || 1);

            if (ratio < 1 || ratio > 2) {
                return res.status(422).send({ message: 'Image aspect ratio is incorrect' });
            }
        } catch (e) {
            return res.status(422).send({ message: 'File is not an image' });
        }

        await fs.copyFile(uploadPath, posterPath);

        for (let size of Object.keys(oblecto.config.artwork.poster)) {
            oblecto.queue.pushJob('rescaleImage', {
                from: oblecto.artworkUtils.moviePosterPath(movie),
                to: oblecto.artworkUtils.moviePosterPath(movie, size),
                width: oblecto.config.artwork.poster[size]
            });
        }

        res.send(['success']);
    });

    server.get('/movie/:id/fanart', async function (req: any, res: Response) {
        let movie = await Movie.findByPk(req.params.id as string);
        if (!movie) return res.status(404).send({ message: 'Movie not found' });

        const path = oblecto.artworkUtils.movieFanartPath(movie, req.combined_params.size || 'large');
        res.sendFile(path);
    });

    server.put('/movie/:id/fanart', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let movie = await Movie.findByPk(req.params.id as string, { include: [File] });

        if (!movie) {
            return res.status(404).send({ message: 'Movie does not exist' });
        }

        let fanartPath = oblecto.artworkUtils.movieFanartPath(movie);

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send({ message: 'Image file is missing' });
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            let image = await sharp(uploadPath);
            let metadata = await image.metadata();
            let ratio = (metadata.height || 0) / (metadata.width || 1);

            if (ratio < 1 || ratio > 2) {
                return res.status(422).send({ message: 'Image aspect ratio is incorrect' });
            }
        } catch (e) {
            return res.status(422).send({ message: 'File is not an image' });
        }

        await fs.copyFile(uploadPath, fanartPath);

        for (let size of Object.keys(oblecto.config.artwork.poster)) {
            oblecto.queue.pushJob('rescaleImage', {
                from: oblecto.artworkUtils.movieFanartPath(movie),
                to: oblecto.artworkUtils.movieFanartPath(movie, size),
                width: oblecto.config.artwork.poster[size]
            });
        }

        res.send(['success']);
    });

    server.get('/movie/:id/info', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let movie = await Movie.findByPk(req.params.id as string, {
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

    server.get('/movie/:id/play', async function (req: Request, res: Response) {
        let movie: any = await Movie.findByPk(req.params.id as string, { include: [{ model: File }] });
        if (!movie || !movie.Files || movie.Files.length === 0) {
            return res.status(404).send({ message: 'No files found for this movie' });
        }

        let file = movie.Files[0];
        res.redirect(`/stream/${file.id}`);
    });

    server.get('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let sets: any = await Movie.findByPk(req.params.id as string, {
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

        res.send(sets ? sets.MovieSets : []);
    });

    server.put('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        try {
            let movie = await Movie.findByPk(req.params.id as string);
            let set = await MovieSet.findByPk(req.combined_params.setId);

            if (!movie || !set) {
                return res.status(404).send({ message: 'Movie or set not found' });
            }

            await set.addMovie(movie);
            res.send({ success: true });
        } catch (e) {
            return res.status(500).send({ message: 'Error adding movie to set' });
        }
    });

    server.get('/movies/search/:name', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        let movie = await Movie.findAll({
            where: { movieName: { [Op.like]: '%' + req.params.name + '%' } },
            include: [File]
        });
        res.send(movie);
    });

    server.get('/movies/watching', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
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
                progress: { [Op.lt]: 0.9 },
                updatedAt: { [Op.gt]: new Date(Date.now() - (1000*60*60*24*7)) }
            },
            order: [['updatedAt', 'DESC'],],
        });

        res.send(tracks.map((track: any) => {
            return track.Movie;
        }));
    });
};
