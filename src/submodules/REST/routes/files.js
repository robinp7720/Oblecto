import authMiddleWare from '../middleware/auth';
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
};
