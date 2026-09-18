import type { Transaction } from 'sequelize';
import { Group } from '../../models/group.js';
import { User } from '../../models/user.js';

// The fixed set of permissions a group can grant. Browsing, playback and
// managing your own account need none of them.
export const PERMISSIONS = {
    'settings.manage': 'Change server settings (providers, sign-in, federation, seedboxes)',
    'users.manage': 'Create, edit and delete users and groups',
    'libraries.manage': 'Manage libraries, sets, artwork and problem files',
    'system.manage': 'Run maintenance and imports, view seedbox status',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ADMIN_GROUP = 'Administrators';
export const DEFAULT_GROUP = 'Users';

export const isPermission = (value: unknown): value is Permission =>
    typeof value === 'string' && value in PERMISSIONS;

export class LockoutError extends Error {
    // Picked up by the REST error handler
    public statusCode = 409;

    constructor() {
        super('This change would leave nobody able to manage users');
        this.name = 'LockoutError';
    }
}

/**
 * Create the built-in groups if they are missing. Safe to call on every start.
 */
export async function seedGroups(): Promise<void> {
    const [admins] = await Group.findOrCreate({
        where: { name: ADMIN_GROUP },
        defaults: {
            name: ADMIN_GROUP, permissions: ALL_PERMISSIONS, builtIn: true 
        }
    });

    // Permissions added in later releases reach the admin group automatically.
    if (ALL_PERMISSIONS.some(permission => !admins.permissions.includes(permission))) {
        admins.permissions = ALL_PERMISSIONS;
        await admins.save();
    }

    await Group.findOrCreate({
        where: { name: DEFAULT_GROUP },
        defaults: {
            name: DEFAULT_GROUP, permissions: [], builtIn: true 
        }
    });
}

export async function defaultGroupId(): Promise<number | null> {
    const group = await Group.findOne({ where: { name: DEFAULT_GROUP } });

    return group?.id ?? null;
}

export async function permissionsOf(user: Pick<User, 'groupId'>): Promise<Permission[]> {
    if (user.groupId === null || user.groupId === undefined) return [];

    const group = await Group.findByPk(user.groupId);

    return group?.permissions ?? [];
}

export async function countAdmins(transaction?: Transaction): Promise<number> {
    const groups = await Group.findAll({ transaction });
    const ids = groups.filter(group => group.permissions.includes('users.manage')).map(group => group.id);

    if (ids.length === 0) return 0;

    return User.count({ where: { groupId: ids }, transaction });
}

/**
 * Run a change and roll it back if nobody would be left holding users.manage.
 */
export async function withAdminGuard<T>(change: (transaction: Transaction) => Promise<T>): Promise<T> {
    const sequelize = User.sequelize!;

    return sequelize.transaction(async transaction => {
        const result = await change(transaction);

        if (await countAdmins(transaction) === 0) throw new LockoutError();

        return result;
    });
}
