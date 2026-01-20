import { promises as fs } from 'fs';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import { Op } from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth.js';

import { TrackMovie } from '../../../models/trackMovie.js';
import { File } from '../../../models/file.js';
import { Movie } from '../../../models/movie.js';
import { MovieSet } from '../../../models/movieSet.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';

export default (server: Express, oblecto: Oblecto) => {
    server.get('/movies/list/:sorting', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        let limit = 20;
        let page = 0;

        const AllowedOrders = ['desc', 'asc'];
        const params = req.combined_params!;

        if (AllowedOrders.indexOf((params.order as string).toLowerCase()) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

        if (!(req.params.sorting in Movie.rawAttributes))
            return res.status(400).send({ message: 'Sorting method is invalid' });

        if (params.count && Number.isInteger(parseInt(params.count as string)))
            limit = parseInt(params.count as string);

        if (params.page && Number.isInteger(parseInt(params.page as string)))
            page = parseInt(params.page as string);

        const results = await Movie.findAll({
            include: [
                {
                    model: TrackMovie,
                    required: false,
                    where: { userId: req.authorization!.user.id }
                }
            ],
            order: [[req.params.sorting, params.order]],
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/movies/sets', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const results = await MovieSet.findAll({});

        res.send(results);
    });

    server.get('/movies/set/:id', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params!;
        const limit = parseInt(params.count as string) || 20;
        const page = parseInt(params.page as string) || 0;

        const AllowedOrders = ['desc', 'asc'];

        if (params.order && AllowedOrders.indexOf((params.order as string).toLowerCase()) === -1)
            return res.status(400).send({ message: 'Sorting order is invalid' });

        const results = await MovieSet.findAll({
            include: [
                {
                    model: Movie,
                    include: [
                        {
                            model: TrackMovie,
                            required: false,
                            where: { userId: req.authorization!.user.id }
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

    server.get('/movie/:id/poster', async function (req: OblectoRequest, res: Response) {
        const movie = await Movie.findByPk(req.params.id as string);

        if (!movie) return res.status(404).send({ message: 'Movie not found' });

        const path = oblecto.artworkUtils.moviePosterPath(movie, (req.combined_params?.size as string) || 'medium');

        res.sendFile(path);
    });

    server.put('/movie/:id/poster', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const movie = await Movie.findByPk(req.params.id as string, { include: [File] });

        if (!movie) {
            return res.status(404).send({ message: 'Movie does not exist' });
        }

        const posterPath = oblecto.artworkUtils.moviePosterPath(movie);

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

        await fs.copyFile(uploadPath, posterPath);

        for (const size of Object.keys(oblecto.config.artwork.poster)) {
            oblecto.queue.pushJob('rescaleImage', {
                from: oblecto.artworkUtils.moviePosterPath(movie),
                to: oblecto.artworkUtils.moviePosterPath(movie, size),
                width: (oblecto.config.artwork.poster as any)[size]
            });
        }

        res.send(['success']);
    });

    server.get('/movie/:id/fanart', async function (req: OblectoRequest, res: Response) {
        const movie = await Movie.findByPk(req.params.id as string);

        if (!movie) return res.status(404).send({ message: 'Movie not found' });

        const path = oblecto.artworkUtils.movieFanartPath(movie, (req.combined_params?.size as string) || 'large');

        res.sendFile(path);
    });

    server.put('/movie/:id/fanart', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const movie = await Movie.findByPk(req.params.id as string, { include: [File] });

        if (!movie) {
            return res.status(404).send({ message: 'Movie does not exist' });
        }

        const fanartPath = oblecto.artworkUtils.movieFanartPath(movie);

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

        await fs.copyFile(uploadPath, fanartPath);

        for (const size of Object.keys(oblecto.config.artwork.poster)) {
            oblecto.queue.pushJob('rescaleImage', {
                from: oblecto.artworkUtils.movieFanartPath(movie),
                to: oblecto.artworkUtils.movieFanartPath(movie, size),
                width: (oblecto.config.artwork.poster as any)[size]
            });
        }

        res.send(['success']);
    });

    server.get('/movie/:id/info', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const movie = await Movie.findByPk(req.params.id as string, {
            include: [
                File,
                {
                    model: TrackMovie,
                    required: false,
                    where: { userId: req.authorization!.user.id }
                }
            ]
        });

        res.send(movie);
    });

    server.get('/movie/:id/play', async function (req: Request, res: Response) {
        const movie: any = await Movie.findByPk(req.params.id as string, { include: [{ model: File }] });

        if (!movie?.Files || movie.Files.length === 0) {
            return res.status(404).send({ message: 'No files found for this movie' });
        }

        const file = movie.Files[0];

        res.redirect(`/stream/${file.id}`);
    });

    server.get('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const sets: any = await Movie.findByPk(req.params.id as string, {
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
                                    where: { userId: req.authorization!.user.id }
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        res.send(sets ? sets.MovieSets : []);
    });

    server.put('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        try {
            const movie = await Movie.findByPk(req.params.id as string);
            const setId = req.combined_params?.setId;
            const set = await MovieSet.findByPk(setId);

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
        const movie = await Movie.findAll({
            where: { movieName: { [Op.like]: '%' + req.params.name + '%' } },
            include: [File]
        });

        res.send(movie);
    });

    server.get('/movies/watching', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const tracks = await TrackMovie.findAll({
            include: [
                {
                    model: Movie,
                    required: true,
                    include: [
                        {
                            model: TrackMovie,
                            required: false,
                            where: { userId: req.authorization!.user.id }
                        }
                    ]
                }
            ],
            where: {
                userId: req.authorization!.user.id,
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
