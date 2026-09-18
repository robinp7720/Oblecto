/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import sharp from 'sharp';
import type { UploadedFile } from 'express-fileupload';
import config from '../../../config.js';
import authMiddleWare from '../middleware/auth.js';
import { User } from '../../../models/user.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';
import errors from '../errors.js';
import { AVATAR_SIZE, avatarDirectory, avatarPath, removeAvatarFile } from '../../../lib/users/avatars.js';
import { Group } from '../../../models/group.js';
import { defaultGroupId, withAdminGuard } from '../../../lib/auth/permissions.js';

const USER_ATTRIBUTES = ['username', 'name', 'email', 'id', 'publicProfile', 'passwordlessLocal', 'avatar', 'groupId'];

// Everything but the password hash.
const publicUser = (user: User) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    publicProfile: user.publicProfile,
    passwordlessLocal: user.passwordlessLocal,
    avatar: user.avatar,
    groupId: user.groupId
});

// undefined when the request doesn't mention a group; throws on an unknown one.
async function requestedGroupId(value: unknown): Promise<number | null | undefined> {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const group = await Group.findByPk(Number(value));

    if (!group) throw new errors.BadRequestError('Group does not exist');

    return group.id;
}

export default (server: Express, oblecto: Oblecto) => {
    server.get('/users', authMiddleWare.requiresPermission('users.manage'), async function (req: Request, res: Response) {
        const users = await User.findAll({ attributes: USER_ATTRIBUTES });

        res.send(users);
    });

    server.get('/user/:id', authMiddleWare.requiresSelfOrPermission('users.manage'), async function (req: Request, res: Response) {
        const user = await User.findOne({
            where: { id: req.params.id },
            attributes: USER_ATTRIBUTES
        });

        res.send(user);
    });

    server.delete('/user/:id', authMiddleWare.requiresPermission('users.manage'), async function (req: Request, res: Response) {
        const user = await User.findOne({
            where: { id: req.params.id },
            attributes: USER_ATTRIBUTES
        });

        if (!user) {
            res.status(404).send({ message: 'User not found' });
            return;
        }

        await withAdminGuard(transaction => user.destroy({ transaction }));
        await removeAvatarFile(oblecto.config, user.avatar);

        res.send(user);
    });

    // Endpoint to update the entries of a certain user
    server.put('/user/:id', authMiddleWare.requiresPermission('users.manage'), async function (req: OblectoRequest, res: Response) {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            res.status(400).send({ message: 'User with id does not exist' });
            return;
        }

        const params = req.combined_params!;

        if (params.username) {
            user.username = params.username as string;
        }

        if (params.password) {
            user.password = await bcrypt.hash(params.password as string, config.authentication.saltRounds);
        }

        if (params.email) {
            user.email = params.email as string;
        }

        if (params.name) {
            user.name = params.name as string;
        }

        if (typeof params.publicProfile === 'boolean') {
            user.publicProfile = params.publicProfile;
        }

        if (typeof params.passwordlessLocal === 'boolean') {
            user.passwordlessLocal = params.passwordlessLocal;
        }

        const groupId = await requestedGroupId(params.groupId);

        if (groupId !== undefined) {
            user.groupId = groupId;
        }

        await withAdminGuard(transaction => user.save({ transaction }));

        res.send(publicUser(user));
    });

    // Public: the login screen shows avatars before anyone has signed in.
    server.get('/user/:id/avatar', async function (req: Request, res: Response) {
        const user = await User.findByPk(req.params.id as string, { attributes: ['id', 'avatar'] });

        if (!user?.avatar) {
            res.status(404).send({ message: 'User has no avatar' });
            return;
        }

        // Every upload gets a new name, so a URL carrying the current one never goes stale.
        res.set('Cache-Control', req.query.v === user.avatar ? 'public, max-age=31536000, immutable' : 'no-cache');
        res.sendFile(avatarPath(oblecto.config, user.avatar), (error) => {
            if (error && !res.headersSent) res.status(404).send({ message: 'User has no avatar' });
        });
    });

    server.put('/user/:id/avatar', authMiddleWare.requiresSelfOrPermission('users.manage'), async function (req: OblectoRequest, res: Response) {
        const user = await User.findByPk(req.params.id as string);

        if (!user) {
            res.status(404).send({ message: 'User not found' });
            return;
        }

        const files = (req.files ?? {}) as Record<string, UploadedFile | UploadedFile[]>;
        const first = Object.values(files)[0];
        const upload = Array.isArray(first) ? first[0] : first;

        if (!upload) {
            res.status(400).send({ message: 'Image file is missing' });
            return;
        }

        const avatar = `${user.id}-${Date.now()}.webp`;

        await fs.mkdir(avatarDirectory(oblecto.config), { recursive: true });

        try {
            await sharp(upload.tempFilePath || upload.data)
                .rotate()
                .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
                .webp()
                .toFile(avatarPath(oblecto.config, avatar));
        } catch {
            res.status(422).send({ message: 'File is not an image' });
            return;
        } finally {
            if (upload.tempFilePath) await fs.rm(upload.tempFilePath, { force: true });
        }

        const previous = user.avatar;

        user.avatar = avatar;
        await user.save();
        await removeAvatarFile(oblecto.config, previous);

        res.send(publicUser(user));
    });

    server.delete('/user/:id/avatar', authMiddleWare.requiresSelfOrPermission('users.manage'), async function (req: Request, res: Response) {
        const user = await User.findByPk(req.params.id as string);

        if (!user) {
            res.status(404).send({ message: 'User not found' });
            return;
        }

        const previous = user.avatar;

        user.avatar = null;
        await user.save();
        await removeAvatarFile(oblecto.config, previous);

        res.send(publicUser(user));
    });

    server.post('/user', authMiddleWare.requiresPermission('users.manage'), async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params!;

        if (!params.username)
            return res.status(400).send({ message: 'Username is missing' });

        if (!params.email)
            return res.status(400).send({ message: 'E-Mail is missing' });
        if (!params.name)
            return res.status(400).send({ message: 'Name is missing' });

        let passwordHash: string | undefined;

        if (params.password)
            passwordHash = await bcrypt.hash(params.password as string, oblecto.config.authentication.saltRounds);

        const groupId = await requestedGroupId(params.groupId);

        const [user] = await User.findOrCreate({
            where: { username: params.username },
            defaults: {
                username: params.username as string,
                name: params.name as string,
                email: params.email as string,
                password: passwordHash || null,
                publicProfile: params.publicProfile === true,
                passwordlessLocal: params.passwordlessLocal === true,
                avatar: null,
                groupId: groupId === undefined ? await defaultGroupId() : groupId
            }
        });

        res.send(publicUser(user));
    });

};