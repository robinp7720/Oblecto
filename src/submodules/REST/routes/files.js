import authMiddleWare from '../middleware/auth';
import errors from '../errors';
import { File } from '../../../models/file';
import { Episode } from '../../../models/episode';
import { Movie } from '../../../models/movie';
import { col, fn } from 'sequelize';

/**
 * @typedef {import('../../../lib/oblecto').default} Oblecto
 * @typedef {import('express').Express} Server
 */

/**
 *
 * @param {Server} server - Express server object
 * @param {Oblecto} oblecto - Oblecto server instance
 */
export default (server, oblecto) => {
    server.get('/files/duplicates', authMiddleWare.requiresAuth, async function (req, res) {
        const fileHashCounts = await File.findAll({
            attributes: [
                'hash',
                [fn('COUNT', col('hash')), 'count']
            ],
            group: ['hash'],
            order: [[fn('COUNT', col('hash')), 'DESC']]
        });

        let duplicates = [];

        for (const fileHashCount of fileHashCounts) {
            // The list of file hashes with counts is sorted descending,
            // which means that once we have reached an item with a duplicate count of less then 2,
            // no files be any duplicates anymore.

            if (fileHashCount.toJSON().count <= 1) break;

            duplicates.push(
                (await File.findAll({
                    where: { hash: fileHashCount.hash },
                    include: [Episode, Movie]

                }))
            );
        }

        res.send(duplicates);
    });

    server.get('/files/problematic', authMiddleWare.requiresAuth, async function (req, res) {
        const brokenFiles = await File.findAll({
            where: { problematic: true }
        });
        res.send(brokenFiles);
    });

    server.post('/files/:id/retry', authMiddleWare.requiresAuth, async function (req, res, next) {
        try {
            const file = await File.findByPk(req.params.id);
            if (!file) return next(new errors.NotFoundError('File not found'));

            // Reset error state
            await file.update({ problematic: false, error: null });

            const filePath = file.path;
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
