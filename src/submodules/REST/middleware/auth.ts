import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import errors from '../errors.js';
import config from '../../../config.js';

export default {
    requiresAuth(req: any, res: Response, next: NextFunction) {
        if (req.authorization === undefined)
            return next(new errors.UnauthorizedError('Session is not authenticated'));

        jwt.verify(req.authorization.credentials || req.combined_params.auth, config.authentication.secret, function (err: any, decoded: any) {
            if (err)
                return next(new errors.UnauthorizedError('An error has occurred during session authentication'));

            req.authorization.user = decoded;

            next();
        });
    },
};
