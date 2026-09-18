import bcrypt from 'bcrypt';
import type { User } from '../../models/user.js';

export const MIN_PASSWORD_LENGTH = 4;

export class PasswordChangeError extends Error {
    // Picked up by the REST error handler
    constructor(message: string, public statusCode: number) {
        super(message);
        this.name = 'PasswordChangeError';
    }
}

/**
 * Change a user's own password. The current password must match, unless the account has none.
 * Changing it also signs the user out everywhere else, since tokens carry a fingerprint of it.
 */
export async function changeOwnPassword(user: User, currentPassword: unknown, newPassword: unknown, saltRounds: number): Promise<void> {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH)
        throw new PasswordChangeError(`The new password needs at least ${MIN_PASSWORD_LENGTH} characters`, 400);

    // An account without a password has nothing to confirm.
    if (user.password && (typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, user.password)))
        throw new PasswordChangeError('Current password is incorrect', 403);

    user.password = await bcrypt.hash(newPassword, saltRounds);
    await user.save();
}
