import bcrypt from 'bcrypt';
import type { IConfig } from '../../interfaces/config.js';

type AuthenticationConfig = Partial<IConfig['authentication']>;
type LoginUser = { password: string | null, passwordlessLocal?: boolean | null };

/**
 * Whether the user may sign in from here without typing a password. Only ever
 * true on the local network: either the user opted in and the server allows
 * local password-less sign-in, or the account has no password at all and
 * allowPasswordlessLogin is on.
 */
export function canSignInWithoutPassword(user: LoginUser, local: boolean, authentication: AuthenticationConfig): boolean {
    if (!local) return false;

    if (authentication.localPasswordlessLogin && user.passwordlessLocal) return true;

    return Boolean(authentication.allowPasswordlessLogin) && !user.password;
}

export async function checkLogin(user: LoginUser, password: string | undefined, local: boolean, authentication: AuthenticationConfig): Promise<boolean> {
    if (canSignInWithoutPassword(user, local, authentication)) return true;

    if (!user.password || !password) return false;

    return bcrypt.compare(password, user.password);
}
