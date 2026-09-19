import { User } from '../../../models/user.js';
import { permissionsOf, type Permission } from '../../auth/permissions.js';
import type { EmbyRequest } from './index.js';

/** Whether the signed-in Jellyfin user's group grants a permission, as the web UI's routes check. */
export async function embyUserCan(req: EmbyRequest, permission: Permission): Promise<boolean> {
    const user = req.embyUserId ? await User.findByPk(req.embyUserId, { attributes: ['id', 'groupId'] }) : null;

    return user !== null && (await permissionsOf(user)).includes(permission);
}
