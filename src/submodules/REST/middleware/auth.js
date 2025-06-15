import jwt from 'jsonwebtoken';
import errors from '../errors';
import config from '../../../config';

export default {
    requiresAuth(req, res, next) {
        if (req.authorization === undefined)
            return next(new errors.UnauthorizedError('Session is not authenticated'));

        jwt.verify(req.authorization.credentials || req.combined_params.auth, config.authentication.secret, function (err, decoded) {
            if (err)
                return next(new errors.UnauthorizedError('An error has occurred during session authentication'));

            req.authorization.user = decoded;

            next();
        });
    },
};
