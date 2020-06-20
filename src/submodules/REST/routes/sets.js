import errors from 'restify-errors';


import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';

import sequelize from 'sequelize';

export default (server) => {

    server.post('/set/movie', authMiddleWare.requiresAuth, async function (req, res, next) {
        if (typeof req.params.public !== 'boolean') {
            return next(new errors.InvalidArgumentError('Argument public is not a boolean'));
        }

        let [set, setInserted] = await databases.movieSet
            .findOrCreate({
                where: {setName: req.params.name}, defaults: {
                    overview: req.params.overview,
                    public: req.params.public
                }
            });


        res.send(set);
    });

};
