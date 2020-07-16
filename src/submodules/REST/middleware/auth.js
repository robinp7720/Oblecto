import jwt from 'jsonwebtoken';
import errors from 'restify-errors';
import config from '../../../config';

export default {
    addAuth(req, res, next) {
        if (req.authorization === undefined)
            return next();

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                return next();
            req.authorization.jwt = decoded;

            next();
        });
    },

    requiresAuth(req, res, next) {
        if (req.authorization === undefined)
            return next(new errors.UnauthorizedError('Session is not authenticated'));

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err) {
            if (err)
                return next(new errors.UnauthorizedError('An error has occured during session authentication'));

            next();
        });
    },
};
