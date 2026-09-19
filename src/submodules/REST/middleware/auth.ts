/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions */
import { Response, NextFunction } from 'express';
import errors from '../errors.js';
import config from '../../../config.js';
import { OblectoRequest } from '../index.js';
import { User } from '../../../models/user.js';
import { Permission, permissionsOf } from '../../../lib/auth/permissions.js';
import { verifyAccessToken } from '../../../lib/auth/tokens.js';

/**
 * The caller's current permissions. Looked up rather than read from the token,
 * so a demotion applies to tokens issued before it.
 */
export async function principalOf(req: OblectoRequest): Promise<{ id: number; permissions: Permission[] } | null> {
    const authorization = req.authorization;

    if (!authorization?.user) return null;
    if (authorization.principal !== undefined) return authorization.principal;

    const user = await User.findByPk(authorization.user.id as number, { attributes: ['id', 'groupId'] });

    authorization.principal = user ? { id: user.id, permissions: await permissionsOf(user) } : null;

    return authorization.principal;
}

const requiresAuth = (req: OblectoRequest, res: Response, next: NextFunction) => {
    if (req.authorization === undefined)
        return next(new errors.UnauthorizedError('Session is not authenticated'));

    const authorization = req.authorization;

    verifyAccessToken(authorization.credentials, config.authentication).then(claims => {
        if (!claims)
            return next(new errors.UnauthorizedError('Your session has expired. Please sign in again.'));

        authorization.user = claims;
        next();
    }).catch(next);
};

const check = (permission: Permission, allowSelf: boolean) => (req: OblectoRequest, res: Response, next: NextFunction) => {
    requiresAuth(req, res, (err?: unknown) => {
        if (err) return next(err);

        principalOf(req).then(principal => {
            if (!principal)
                return next(new errors.UnauthorizedError('User no longer exists'));

            if (allowSelf && String(principal.id) === String(req.params.id))
                return next();

            if (!principal.permissions.includes(permission))
                return next(new errors.ForbiddenError('You do not have permission to do this'));

            next();
        }).catch(next);
    });
};

export default {
    requiresAuth,

    // Authenticates, then requires the caller's group to grant the permission.
    requiresPermission: (permission: Permission) => check(permission, false),

    // As requiresPermission, but a user may always act on their own :id.
    requiresSelfOrPermission: (permission: Permission) => check(permission, true),
};
