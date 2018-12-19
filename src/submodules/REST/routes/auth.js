import jwt from 'jsonwebtoken';
import errors from 'restify-errors';
import bcrypt from 'bcrypt';

import databases from '../../../submodules/database';
import config from '../../../config';

export default (server) => {
    server.post('/auth/login', async function (req, res, next) {
        if (!req.params.username)
            return next(new errors.BadRequestError('Username is missing'));

        // TODO: Implement password hashing
        let user = await databases.user.findOne({
            where: {
                username: req.params.username
            },
            attributes: ['username', 'name', 'email', 'password', 'id']
        });
        
        // Don't send a token if the user doesn't exist
        if (!user)
            return next(new errors.UnauthorizedError('Username is incorrect'));

        let allowLogin = true;

        if (user.password)
            allowLogin = await bcrypt.compare(req.params.password, user.password);

        if (!allowLogin)
            return next(new errors.UnauthorizedError('Password is incorrect'));

        let token = jwt.sign(user.toJSON(), config.authentication.secret);
        user['access_token'] = token;
        res.send(user);
    });

    server.get('/auth/isAuthenticated', function (req, res, next) {
        if (req.authorization === undefined)
            return res.send([false]);

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err) {
            if (err)
                res.send([false]);
            else
                res.send([true]);
            next();
        });
    });
};