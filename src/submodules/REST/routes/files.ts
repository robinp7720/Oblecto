import { col, fn, WhereOptions } from 'sequelize';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../middleware/auth.js';
import { File } from '../../../models/file.js';
import { Episode } from '../../../models/episode.js';
import { Movie } from '../../../models/movie.js';
import { Series } from '../../../models/series.js';
import { retryProblem } from '../../../lib/indexers/files/problems.js';
import { validateSegments } from '../../../lib/analysis/segments.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';

/**
 * Filter for problematic files. Ignored files are left out unless
 * `includeIgnored` is set, and `stage` narrows to one kind of failure.
 * @param query - Request query or body
 * @param query.stage - Only files that failed at this stage
 * @param query.includeIgnored - Whether to include ignored files
 * @returns - Sequelize where clause
 */
function problematicWhere(query: { stage?: unknown; includeIgnored?: unknown }): WhereOptions<File> {
    const where: WhereOptions<File> = { problematic: true };

    if (query.stage === 'identify' || query.stage === 'probe') where.problemStage = query.stage;
    if (query.includeIgnored !== 'true' && query.includeIgnored !== true) where.problemIgnored = false;

    return where;
}

export default (server: Express, oblecto: Oblecto) => {
    server.get('/files/duplicates', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response) {
        const fileHashCounts = await File.findAll({
            attributes: [
                'hash',
                [fn('COUNT', col('hash')), 'count']
            ],
            group: ['hash'],
            order: [[fn('COUNT', col('hash')), 'DESC']]
        });

        const duplicates = [];

        for (const fileHashCount of fileHashCounts) {
            const data: any = fileHashCount.toJSON();

            if (data.count <= 1) break;

            duplicates.push(
                (await File.findAll({
                    where: { hash: data.hash },
                    include: [Episode, Movie]
                }))
            );
        }

        res.send(duplicates);
    });

    server.get('/files/problematic', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response, next: NextFunction) {
        try {
            const files = await File.findAll({
                where: problematicWhere(req.query),
                attributes: ['id', 'path', 'name', 'directory', 'error', 'problemStage', 'problemIgnored', 'updatedAt'],
                include: [
                    {
                        model: Movie,
                        attributes: ['id', 'movieName'],
                        through: { attributes: [] }
                    },
                    {
                        model: Episode,
                        attributes: ['id', 'episodeName', 'airedSeason', 'airedEpisodeNumber'],
                        through: { attributes: [] },
                        include: [{ model: Series, attributes: ['id', 'seriesName'] }]
                    }
                ],
                order: [['updatedAt', 'DESC']]
            });

            res.send(files);
        } catch (e) {
            next(e);
        }
    });

    // Registered before `/files/:id/retry` so `problematic` is not taken for an id
    server.post('/files/problematic/retry', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response, next: NextFunction) {
        try {
            const files = await File.findAll({ where: problematicWhere({ stage: req.body?.stage }) });

            let queued = 0;
            const removedIds: number[] = [];
            const skippedIds: number[] = [];

            for (const file of files) {
                const result = await retryProblem(oblecto, file);

                if (result.status === 'queued') queued++;
                if (result.status === 'missing') removedIds.push(file.id);
                if (result.status === 'outside') skippedIds.push(file.id);
            }

            res.status(202).send({
                queued,
                removedIds,
                skippedIds
            });
        } catch (e) {
            next(e);
        }
    });

    server.post('/files/:id/retry', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response, next: NextFunction) {
        try {
            const file = await File.findByPk(req.params.id as string);

            if (!file) {
                res.status(404).send({ message: 'File not found' });
                return;
            }

            if (!file.problematic) {
                res.status(409).send({ message: 'File is not problematic' });
                return;
            }

            // The flag stays set until the queued job succeeds, so a retry
            // that fails again leaves the file listed with its new error
            const result = await retryProblem(oblecto, file);

            if (result.status === 'missing') {
                res.status(410).send({ message: 'File no longer exists and has been removed' });
                return;
            }

            if (result.status === 'outside') {
                res.status(400).send({ message: 'File is not inside any configured library directory' });
                return;
            }

            res.status(202).send({ queued: true, jobs: result.jobs });
        } catch (e) {
            next(e);
        }
    });

    server.patch('/files/:id', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response, next: NextFunction) {
        try {
            const problemIgnored = req.body?.problemIgnored;

            if (typeof problemIgnored !== 'boolean') {
                res.status(400).send({ message: 'problemIgnored must be a boolean' });
                return;
            }

            const file = await File.findByPk(req.params.id as string);

            if (!file) {
                res.status(404).send({ message: 'File not found' });
                return;
            }

            await file.update({ problemIgnored });

            res.send({ id: file.id, problemIgnored: file.problemIgnored });
        } catch (e) {
            next(e);
        }
    });

    // Chapters, skippable segments and seek thumbnails. Null means the file has not been analysed yet.
    const markers = (file: File) => ({
        id: file.id,
        duration: file.duration,
        chapters: file.chapters,
        segments: file.segments,
        trickplay: file.trickplay
    });

    server.get('/files/:id/markers', authMiddleWare.requiresAuth, async function (req: Request, res: Response, next: NextFunction) {
        try {
            const file = await File.findByPk(req.params.id as string);

            if (!file) {
                res.status(404).send({ message: 'File not found' });
                return;
            }

            res.send(markers(file));
        } catch (e) {
            next(e);
        }
    });

    // Segments set here are kept: detection only looks at files that have none
    server.put('/files/:id/segments', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response, next: NextFunction) {
        try {
            const file = await File.findByPk(req.params.id as string);

            if (!file) {
                res.status(404).send({ message: 'File not found' });
                return;
            }

            const result = validateSegments(req.body?.segments, file.duration);

            if ('error' in result) {
                res.status(400).send({ message: result.error });
                return;
            }

            await file.update({ segments: result.segments });
            res.send(markers(file));
        } catch (e) {
            next(e);
        }
    });

    server.delete('/files/:id/segments', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response, next: NextFunction) {
        try {
            const file = await File.findByPk(req.params.id as string);

            if (!file) {
                res.status(404).send({ message: 'File not found' });
                return;
            }

            await oblecto.mediaAnalyser.resetSegments(file);
            res.status(202).send(markers(file));
        } catch (e) {
            next(e);
        }
    });
};