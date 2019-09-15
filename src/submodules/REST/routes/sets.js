import path from 'path';
import fs from 'fs';
import errors from 'restify-errors';

import jimp from 'jimp';

import databases from '../../../submodules/database';
import UserManager from '../../users';
import authMiddleWare from '../middleware/auth';

import config from '../../../config.js';
import sequelize from 'sequelize';

const Op = sequelize.Op;

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
