import jwt from "jsonwebtoken";
import errors from "restify-errors"

import databases from "../../../submodules/database";
import config from "../../../config";

export default (server) => {
    server.post('/auth/login', async function (req, res, next) {
        if (!req.params.username)
            return next(new errors.BadRequestError('Username is missing'))

        // TODO: Implement password hashing
        let user = await databases.user.findOne({
            where: {
                username: req.params.username
            },
            attributes: ['username', 'name', 'email', 'id']
        })
        
        // Don't send a token if the user doesn't exist
        if (!user)
            return next(new errors.UnauthorizedError('Username is incorrect'))

        // TODO: implement password checking
        let token = jwt.sign(user.toJSON(), config.authentication.secret);
        user['access_token'] = token;
        res.send(user);
        next();

    });

    server.get('/auth/isAuthenticated', function (req, res, next) {
        if (req.authorization === undefined)
            return res.send([false]);

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                res.send([false]);
            else
                res.send([true]);
            next();
        });
    });
};