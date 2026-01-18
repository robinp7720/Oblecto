import { Express } from 'express';
import errors from '../errors.js';
import authMiddleWare from '../middleware/auth.js';
import { MovieSet } from '../../../models/movieSet.js';
import { SeriesSet } from '../../../models/seriesSet.js';

export default (server: Express, oblecto: any) => {

    server.post('/set/movie', authMiddleWare.requiresAuth, async function (req: any, res: any) {
        if (typeof req.combined_params.public !== 'boolean') {
            return new errors.InvalidArgumentError('Argument public is not a boolean');
        }

        let [set] = await MovieSet
            .findOrCreate({
                where: { setName: req.combined_params.name },
                defaults: {
                    overview: req.combined_params.overview,
                    public: req.combined_params.public
                }
            });

        res.send(set);
    });

    server.post('/set/series', authMiddleWare.requiresAuth, async function (req: any, res: any) {
        if (typeof req.combined_params.public !== 'boolean') {
            return new errors.InvalidArgumentError('Argument public is not a boolean');
        }

        let [set] = await SeriesSet
            .findOrCreate({
                where: { setName: req.combined_params.name },
                defaults: {
                    overview: req.combined_params.overview,
                    public: req.combined_params.public
                }
            });

        res.send(set);
    });

    server.delete('/set/movie/:id', authMiddleWare.requiresAuth, async function (req: any, res: any) {
        let set = await MovieSet.findByPk(req.params.id);
        if (!set) throw new errors.NotFoundError('Set not found');
        await set.destroy();
        res.send({ success: true });
    });

    server.delete('/set/series/:id', authMiddleWare.requiresAuth, async function (req: any, res: any) {
        let set = await SeriesSet.findByPk(req.params.id);
        if (!set) throw new errors.NotFoundError('Set not found');
        await set.destroy();
        res.send({ success: true });
    });

};
