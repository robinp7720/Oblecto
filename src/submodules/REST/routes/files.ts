import { col, fn } from 'sequelize';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/unbound-method, @typescript-eslint/no-unused-vars */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../middleware/auth.js';
import { File } from '../../../models/file.js';
import { Episode } from '../../../models/episode.js';
import { Movie } from '../../../models/movie.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';

export default (server: Express, oblecto: Oblecto) => {
    server.get('/files/duplicates', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
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

    server.get('/files/problematic', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const brokenFiles = await File.findAll({ where: { problematic: true } });

        res.send(brokenFiles);
    });

    server.post('/files/:id/retry', authMiddleWare.requiresAuth, async function (req: Request, res: Response, next: NextFunction) {
        try {
            const file = await File.findByPk(req.params.id as string);

            if (!file) {
                res.status(404).send({ message: 'File not found' });
                return;
            }

            // Reset error state
            await file.update({ problematic: false, error: null });

            const filePath = file.path;

            if (!filePath) {
                res.status(400).send({ message: 'File path is missing' });
                return;
            }

            let queued = false;

            // Check Movie Directories
            const movieDirs = oblecto.config.movies.directories || [];

            for (const dir of movieDirs) {
                if (filePath.startsWith(dir.path)) {
                    oblecto.queue.queueJob('indexMovie', { path: filePath, doReIndex: true });
                    queued = true;
                    break;
                }
            }

            // Check TV Directories
            if (!queued) {
                const tvDirs = oblecto.config.tvshows.directories || [];

                for (const dir of tvDirs) {
                    if (filePath.startsWith(dir.path)) {
                        oblecto.queue.queueJob('indexEpisode', { path: filePath });
                        queued = true;
                        break;
                    }
                }
            }
            
            // If not matched, try to re-index streams directly as a fallback
            if (!queued) {
                oblecto.queue.queueJob('indexFileStreams', file);
            }

            res.send({ success: true, message: 'Retry scheduled' });
        } catch (e) {
            next(e);
        }
    });
};