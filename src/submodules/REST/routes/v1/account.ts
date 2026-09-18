import { Express, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import { OblectoRequest } from '../../index.js';
import { User } from '../../../../models/user.js';
import { Group } from '../../../../models/group.js';
import { publicUser } from '../users.js';
import { clearAvatar, firstUpload, saveAvatar } from '../../../../lib/users/avatars.js';
import { resolvePreferences, validatePreferences } from '../../../../lib/users/preferences.js';
import type Oblecto from '../../../../lib/oblecto/index.js';
import upload from '../../middleware/upload.js';

const MIN_PASSWORD_LENGTH = 4;

async function currentUser(req: OblectoRequest): Promise<User> {
    const id = (req.authorization?.user as { id?: number } | undefined)?.id;
    const user = id === undefined ? null : await User.findByPk(id);

    if (!user) throw new errors.UnauthorizedError('User no longer exists');

    return user;
}

async function describe(user: User) {
    const group = user.groupId === null ? null : await Group.findByPk(user.groupId);

    return {
        ...publicUser(user),
        hasPassword: Boolean(user.password),
        group: group ? { id: group.id, name: group.name } : null,
        permissions: group?.permissions ?? [],
        preferences: resolvePreferences(user.preferences)
    };
}

const optionalText = (value: unknown, field: string): string | null => {
    if (value === null) return null;
    if (typeof value !== 'string') throw new errors.BadRequestError(`${field} must be text`);

    return value.trim() || null;
};

// The signed-in user's own account. Group, username and sign-in flags stay
// with whoever holds users.manage.
export default (server: Express, oblecto: Oblecto) => {
    server.get('/api/v1/me', authMiddleWare.requiresAuth, async (req: OblectoRequest, res: Response, next: NextFunction) => {
        try {
            res.send(await describe(await currentUser(req)));
        } catch (error) {
            next(error);
        }
    });

    server.patch('/api/v1/me', authMiddleWare.requiresAuth, async (req: OblectoRequest, res: Response, next: NextFunction) => {
        try {
            const user = await currentUser(req);
            const body = (req.body ?? {}) as { name?: unknown; email?: unknown; preferences?: unknown };

            if (body.preferences !== undefined) {
                const fields = validatePreferences(body.preferences);

                if (Object.keys(fields).length) {
                    res.status(400).send({ error: 'Check the highlighted preferences.', fields });
                    return;
                }

                user.preferences = { ...(user.preferences ?? {}), ...(body.preferences as Record<string, unknown>) };
            }

            if (body.name !== undefined) user.name = optionalText(body.name, 'Name');
            if (body.email !== undefined) user.email = optionalText(body.email, 'E-mail');

            await user.save();

            res.send(await describe(user));
        } catch (error) {
            next(error);
        }
    });

    server.put('/api/v1/me/password', authMiddleWare.requiresAuth, async (req: OblectoRequest, res: Response, next: NextFunction) => {
        try {
            const user = await currentUser(req);
            const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: unknown; newPassword?: unknown };

            if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH)
                throw new errors.BadRequestError(`The new password needs at least ${MIN_PASSWORD_LENGTH} characters`);

            // An account without a password has nothing to confirm.
            if (user.password) {
                if (typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, user.password))
                    throw new errors.ForbiddenError('Current password is incorrect');
            }

            user.password = await bcrypt.hash(newPassword, oblecto.config.authentication.saltRounds);
            await user.save();

            res.send(await describe(user));
        } catch (error) {
            next(error);
        }
    });

    server.put('/api/v1/me/avatar', authMiddleWare.requiresAuth, upload, async (req: OblectoRequest, res: Response, next: NextFunction) => {
        try {
            const user = await currentUser(req);

            await saveAvatar(oblecto.config, user, firstUpload(req.files));
            res.send(await describe(user));
        } catch (error) {
            next(error);
        }
    });

    server.delete('/api/v1/me/avatar', authMiddleWare.requiresAuth, async (req: OblectoRequest, res: Response, next: NextFunction) => {
        try {
            const user = await currentUser(req);

            await clearAvatar(oblecto.config, user);
            res.send(await describe(user));
        } catch (error) {
            next(error);
        }
    });
};
