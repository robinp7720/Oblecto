import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import errors from '../../errors.js';
import { Group } from '../../../../models/group.js';
import { User } from '../../../../models/user.js';
import {ADMIN_GROUP, DEFAULT_GROUP, PERMISSIONS, Permission, isPermission, withAdminGuard} from '../../../../lib/auth/permissions.js';
import type Oblecto from '../../../../lib/oblecto/index.js';

const publicGroup = (group: Group, members: number) => ({
    id: group.id,
    name: group.name,
    permissions: group.permissions,
    builtIn: group.builtIn,
    members
});

function parseName(value: unknown): string {
    if (typeof value !== 'string' || !value.trim())
        throw new errors.BadRequestError('Group name is missing');

    return value.trim();
}

function parsePermissions(value: unknown): Permission[] {
    if (!Array.isArray(value) || !value.every(isPermission))
        throw new errors.BadRequestError('Permissions must be a list of known permissions');

    return [...new Set(value)];
}

async function nameTaken(name: string, exceptId?: number): Promise<boolean> {
    const existing = await Group.findOne({ where: { name } });

    return existing !== null && existing.id !== exceptId;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default (server: Express, oblecto: Oblecto) => {
    const manage = authMiddleWare.requiresPermission('users.manage');

    server.get('/api/v1/permissions', manage, (req: Request, res: Response) => {
        res.send(Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })));
    });

    server.get('/api/v1/groups', manage, async (req: Request, res: Response) => {
        const groups = await Group.findAll({ order: [['id', 'ASC']] });
        const counts = await Promise.all(groups.map(group => User.count({ where: { groupId: group.id } })));

        res.send(groups.map((group, index) => publicGroup(group, counts[index])));
    });

    server.post('/api/v1/groups', manage, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = (req.body ?? {}) as { name?: unknown; permissions?: unknown };
            const name = parseName(body.name);
            const permissions = parsePermissions(body.permissions ?? []);

            if (await nameTaken(name)) throw new errors.ConflictError('A group with that name already exists');

            const group = await Group.create({
 name, permissions, builtIn: false 
});

            res.send(publicGroup(group, 0));
        } catch (error) {
            next(error);
        }
    });

    server.patch('/api/v1/groups/:id', manage, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const group = await Group.findByPk(req.params.id as string);

            if (!group) throw new errors.NotFoundError('Group not found');

            const body = (req.body ?? {}) as { name?: unknown; permissions?: unknown };

            if (body.name !== undefined) {
                const name = parseName(body.name);

                // Built-in groups are found by name when seeding
                if (group.builtIn && name !== group.name) throw new errors.ConflictError('Built-in groups cannot be renamed');
                if (await nameTaken(name, group.id)) throw new errors.ConflictError('A group with that name already exists');
                group.name = name;
            }

            if (body.permissions !== undefined) {
                const permissions = parsePermissions(body.permissions);

                if (group.builtIn && group.name === ADMIN_GROUP && !permissions.includes('users.manage'))
                    throw new errors.ConflictError(`${ADMIN_GROUP} always keeps the permission to manage users`);
                group.permissions = permissions;
            }

            await withAdminGuard(transaction => group.save({ transaction }));

            res.send(publicGroup(group, await User.count({ where: { groupId: group.id } })));
        } catch (error) {
            next(error);
        }
    });

    // Members move to the default group.
    server.delete('/api/v1/groups/:id', manage, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const group = await Group.findByPk(req.params.id as string);

            if (!group) throw new errors.NotFoundError('Group not found');
            if (group.builtIn) throw new errors.ConflictError('Built-in groups cannot be deleted');

            const fallback = await Group.findOne({ where: { name: DEFAULT_GROUP } });

            await withAdminGuard(async transaction => {
                await User.update({ groupId: fallback?.id ?? null }, { where: { groupId: group.id }, transaction });
                await group.destroy({ transaction });
            });

            res.send({ id: group.id });
        } catch (error) {
            next(error);
        }
    });
};
