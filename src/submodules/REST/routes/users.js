import errors from 'restify-errors';
import bcrypt from 'bcrypt';

import databases from '../../../submodules/database';
import config from '../../../config';
import authMiddleWare from '../middleware/auth';


export default (server) => {
    server.get('/users', async function (req, res, next) {
        let users = await databases.user.findAll({
            attributes: ['username', 'name', 'email', 'id']
        });

        res.send(users);
        next();
    });

    server.get('/user/:username', authMiddleWare.requiresAuth, async function (req, res, next) {
        let user = await databases.user.findOne({
            where: {
                username: req.params.username
            },
            attributes: ['username', 'name', 'email', 'id']
        });

        res.send(user);

        next();
    });

    server.del('/user/:username', authMiddleWare.requiresAuth, async function (req, res, next) {
        let user = await databases.user.findOne({
            where: {
                username: req.params.username
            },
            attributes: ['username', 'name', 'email', 'id']
        });

        // Send the user information of the user to the client first
        res.send(user);

        // Now delete the user
        user.destroy();

        next();
    });

    server.put('/user/:username', authMiddleWare.requiresAuth, async function (req, res, next) {
        // Make sure the required input fields are present, and if not send a bad request error with the associated information to the error
        if (!req.params.username)
            return next(new errors.BadRequestError('Username is missing'));
        if (!req.params.password)
            return next(new errors.BadRequestError('Password is missing'));
        if (!req.params.email)
            return next(new errors.BadRequestError('E-Mail is missing'));
        if (!req.params.name)
            return next(new errors.BadRequestError('Name is missing'));


        let passwordHash = await bcrypt.hash(req.params.password, config.authentication.saltRounds);

        let [User] = await databases.user.findOrCreate({
            where: {
                username: req.params.username
            },
            defaults: {
                name: req.params.name,
                email: req.params.email,
                password: passwordHash
            }
        });

        res.send(User);

        next();

    });


};