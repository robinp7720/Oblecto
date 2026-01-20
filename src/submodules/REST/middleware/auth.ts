/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import errors from '../errors.js';
import config from '../../../config.js';
import { OblectoRequest } from '../index.js';

export default {
    requiresAuth(req: OblectoRequest, res: Response, next: NextFunction) {
        if (req.authorization === undefined)
            return next(new errors.UnauthorizedError('Session is not authenticated'));

        jwt.verify(req.authorization.credentials || (req.combined_params?.auth), config.authentication.secret, function (err: any, decoded: any) {
            if (err)
                return next(new errors.UnauthorizedError('An error has occurred during session authentication'));

            if (req.authorization) {
                req.authorization.user = decoded;
            }

            next();
        });
    },
};
