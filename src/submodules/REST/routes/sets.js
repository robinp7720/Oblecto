import errors from '../errors';

import authMiddleWare from '../middleware/auth';

import { MovieSet } from '../../../models/movieSet';

export default (server) => {

    server.post('/set/movie', authMiddleWare.requiresAuth, async function (req, res) {
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

};
