import errors from 'restify-errors';

import authMiddleWare from '../middleware/auth';

import { MovieSet } from '../../../models/movieSet';

export default (server) => {

    server.post('/set/movie', authMiddleWare.requiresAuth, async function (req, res, next) {
        if (typeof req.params.public !== 'boolean') {
            return next(new errors.InvalidArgumentError('Argument public is not a boolean'));
        }

        let [set] = await MovieSet
            .findOrCreate({
                where: { setName: req.params.name },
                defaults: {
                    overview: req.params.overview,
                    public: req.params.public
                }
            });

        res.send(set);
    });

};
