import path from 'path';
import { promises as fs } from 'fs';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/restrict-plus-operands, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import { Op, literal, where } from 'sequelize';
import sharp from 'sharp';

import authMiddleWare from '../middleware/auth.js';
import errors from '../errors.js';

import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { SeriesSet } from '../../../models/seriesSet.js';
import { File } from '../../../models/file.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';
import { parseBrowseParams, decodeCursor, buildCursorWhere, encodeCursor, escapeLike } from './helpers/browse.js';

const LEGACY_ALLOWED_ORDERS = ['desc', 'asc'];
const BROWSE_SORT_FIELDS = new Set([
    'seriesName',
    'firstAired',
    'createdAt',
    'updatedAt',
    'siteRating',
    'siteRatingCount',
    'popularity'
]);

const normalizeGenres = (raw: unknown): string[] => {
    if (!raw || typeof raw !== 'string') return [];

    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
            return parsed.map(entry => String(entry).trim()).filter(Boolean);
        }
    } catch (error) {
        // Fall back to comma-separated parsing.
    }

    return trimmed.split(',').map(entry => entry.trim()).filter(Boolean);
};

const buildSeriesProgressLiteral = (
    userId: number,
    conditionType: 'watched' | 'inprogress' | 'hasProgress',
    negate = false
): any => {
    const queryGenerator = Series.sequelize?.getQueryInterface().queryGenerator;

    if (!queryGenerator) {
        return null;
    }

    const seriesTable = queryGenerator.quoteTable(Series.getTableName() as any);
    const episodeTable = queryGenerator.quoteTable(Episode.getTableName() as any);
    const trackTable = queryGenerator.quoteTable(TrackEpisode.getTableName() as any);

    const seriesIdColumn = `${seriesTable}.${queryGenerator.quoteIdentifier('id')}`;
    const episodeSeriesIdColumn = `${episodeTable}.${queryGenerator.quoteIdentifier('SeriesId')}`;
    const episodeIdColumn = `${episodeTable}.${queryGenerator.quoteIdentifier('id')}`;
    const trackEpisodeIdColumn = `${trackTable}.${queryGenerator.quoteIdentifier('episodeId')}`;
    const trackUserIdColumn = `${trackTable}.${queryGenerator.quoteIdentifier('userId')}`;
    const trackProgressColumn = `${trackTable}.${queryGenerator.quoteIdentifier('progress')}`;

    let progressCondition = `${trackProgressColumn} > 0`;

    if (conditionType === 'watched') {
        progressCondition = `${trackProgressColumn} >= 0.9`;
    } else if (conditionType === 'inprogress') {
        progressCondition = `${trackProgressColumn} > 0 AND ${trackProgressColumn} < 0.9`;
    }

    const existsClause = `EXISTS (
        SELECT 1
        FROM ${episodeTable}
        INNER JOIN ${trackTable}
          ON ${trackEpisodeIdColumn} = ${episodeIdColumn}
        WHERE ${episodeSeriesIdColumn} = ${seriesIdColumn}
          AND ${trackUserIdColumn} = ${Number(userId)}
          AND ${progressCondition}
    )`;

    return where(literal(negate ? `NOT ${existsClause}` : existsClause), true);
};

export default (server: Express, oblecto: Oblecto) => {
    server.get('/series/list/:sorting', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params || {};

        let browseParams;
        try {
            browseParams = parseBrowseParams(params);
        } catch (error: any) {
            return res.status(400).send({ message: error.message || 'Invalid browse query' });
        }

        if (browseParams.mode !== 'browse') {
            const limit = parseInt((params.count as string) || '20', 10) || 20;
            const page = parseInt((params.page as string) || '0', 10) || 0;
            const legacyOrder = (params.order as string)?.toLowerCase() || 'asc';

            if (LEGACY_ALLOWED_ORDERS.indexOf(legacyOrder) === -1)
                return res.status(400).send({ message: 'Sorting order is invalid' });

            if (!(req.params.sorting in Series.rawAttributes))
                return res.status(400).send({ message: 'Sorting method is invalid' });

            const results = await Series.findAll({
                order: [[req.params.sorting, legacyOrder]],
                limit,
                offset: limit * page
            });

            return res.send(results);
        }

        const sorting = req.params.sorting;
        if (!BROWSE_SORT_FIELDS.has(sorting)) {
            return res.status(400).send({ message: 'Sorting method is invalid' });
        }

        const whereClauses: any[] = [];
        const includeClauses: any[] = [];

        if (browseParams.q) {
            const query = `%${escapeLike(browseParams.q)}%`;
            whereClauses.push({
                [Op.or]: [
                    { seriesName: { [Op.like]: query } },
                    { alias: { [Op.like]: query } }
                ]
            });
        }

        if (browseParams.genres.length > 0) {
            whereClauses.push({
                [Op.or]: browseParams.genres.map((genre: string) => {
                    return { genre: { [Op.like]: `%${escapeLike(genre)}%` } };
                })
            });
        }

        if (browseParams.yearFrom !== null || browseParams.yearTo !== null) {
            const firstAiredFilter: any = {};

            if (browseParams.yearFrom !== null) {
                firstAiredFilter[Op.gte] = `${browseParams.yearFrom.toString().padStart(4, '0')}-01-01`;
            }

            if (browseParams.yearTo !== null) {
                firstAiredFilter[Op.lte] = `${browseParams.yearTo.toString().padStart(4, '0')}-12-31`;
            }

            whereClauses.push({ firstAired: firstAiredFilter });
        }

        if (browseParams.watched === 'watched') {
            const watchedClause = buildSeriesProgressLiteral(req.authorization!.user.id, 'watched');
            if (watchedClause) whereClauses.push(watchedClause);
        } else if (browseParams.watched === 'inprogress') {
            const inProgressClause = buildSeriesProgressLiteral(req.authorization!.user.id, 'inprogress');
            if (inProgressClause) whereClauses.push(inProgressClause);
        } else if (browseParams.watched === 'unwatched') {
            const unwatchedClause = buildSeriesProgressLiteral(req.authorization!.user.id, 'hasProgress', true);
            if (unwatchedClause) whereClauses.push(unwatchedClause);
        }

        if (browseParams.libraryPath) {
            includeClauses.push({
                model: Episode,
                attributes: [],
                required: true,
                include: [
                    {
                        model: File,
                        attributes: [],
                        through: { attributes: [] },
                        required: true,
                        where: {
                            path: {
                                [Op.like]: `${escapeLike(browseParams.libraryPath)}%`
                            }
                        }
                    }
                ]
            });
        }

        const baseWhereClauses = [...whereClauses];

        const facetQueryOptions: any = {
            attributes: ['genre', 'firstAired'],
            include: includeClauses,
            distinct: true,
            subQuery: false
        };

        if (baseWhereClauses.length > 0) {
            facetQueryOptions.where = { [Op.and]: baseWhereClauses };
        }

        const facetRows = await Series.findAll(facetQueryOptions);
        const genres = Array.from(new Set(facetRows.flatMap(item => normalizeGenres((item as any).genre))));
        const years = Array.from(new Set(facetRows
            .map(item => {
                const value = (item as any).firstAired;
                if (!value) return null;

                const parsed = parseInt(String(value).slice(0, 4), 10);
                return Number.isInteger(parsed) ? parsed : null;
            })
            .filter(Boolean) as number[])).sort((a, b) => a - b);

        if (browseParams.cursor) {
            try {
                const parsedCursor = decodeCursor(
                    browseParams.cursor,
                    sorting,
                    browseParams.order,
                    browseParams.filterHash
                );
                whereClauses.push(buildCursorWhere(sorting, browseParams.order, parsedCursor.sortValue, parsedCursor.id));
            } catch (error: any) {
                return res.status(400).send({ message: error.message || 'cursor is invalid' });
            }
        }

        const queryOptions: any = {
            include: includeClauses,
            order: [[sorting, browseParams.order], ['id', browseParams.order]],
            limit: browseParams.count + 1,
            distinct: true,
            subQuery: false
        };

        if (whereClauses.length > 0) {
            queryOptions.where = { [Op.and]: whereClauses };
        }

        if (!browseParams.cursor && browseParams.page > 0) {
            queryOptions.offset = browseParams.count * browseParams.page;
        }

        const results = await Series.findAll(queryOptions);
        const hasNextPage = results.length > browseParams.count;
        const items = hasNextPage ? results.slice(0, browseParams.count) : results;

        let nextCursor: string | null = null;

        if (hasNextPage && items.length > 0) {
            const lastItem: any = items[items.length - 1];
            nextCursor = encodeCursor(
                sorting,
                browseParams.order,
                lastItem[sorting as keyof Series] ?? null,
                Number(lastItem.id),
                browseParams.filterHash
            );
        }

        return res.send({
            items,
            pageInfo: {
                hasNextPage,
                nextCursor,
                count: items.length
            },
            appliedFilters: {
                q: browseParams.q,
                genre: browseParams.genres,
                yearFrom: browseParams.yearFrom,
                yearTo: browseParams.yearTo,
                watched: browseParams.watched,
                libraryPath: browseParams.libraryPath
            },
            facets: {
                genres,
                years
            }
        });
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
