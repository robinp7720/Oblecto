import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { User } from '../../models/user.js';

export type TokenSettings = {
    secret: string;
    // How long a web sign-in lasts before the user has to sign in again
    tokenLifetimeDays?: number;
};

export type AccessClaims = {
    id: number;
    username: string;
    name: string | null;
    email: string | null;
    // Fingerprint of the password hash the token was issued against
    cs: string;
    iat: number;
    exp: number;
};

type TokenUser = Pick<User, 'id' | 'password'> & Partial<Pick<User, 'username' | 'name' | 'email'>>;

export const DEFAULT_TOKEN_LIFETIME_DAYS = 30;

/**
 * Short fingerprint of the stored password hash. Tokens carry it, so changing or removing a password
 * signs the user out everywhere without a revocation list or an extra column.
 */
export function credentialStamp(password: string | null | undefined): string {
    return createHash('sha256').update(`oblecto-credential:${password ?? ''}`).digest('base64url').slice(0, 16);
}

/** A signed, expiring token for the REST API, the web UI and the realtime socket. */
export function issueAccessToken(user: TokenUser, settings: TokenSettings): string {
    const days = settings.tokenLifetimeDays ?? DEFAULT_TOKEN_LIFETIME_DAYS;

    return jwt.sign({
        id: user.id,
        username: user.username,
        name: user.name ?? null,
        email: user.email ?? null,
        cs: credentialStamp(user.password)
    }, settings.secret, { expiresIn: `${days}d` });
}

/** The token's claims when its signature and expiry hold, its user still exists and their password is unchanged. */
export async function verifyAccessToken(token: unknown, settings: TokenSettings): Promise<AccessClaims | null> {
    if (typeof token !== 'string' || token === '') return null;

    let claims: AccessClaims;

    try {
        claims = jwt.verify(token, settings.secret) as AccessClaims;
    } catch {
        return null;
    }

    if (typeof claims !== 'object' || !Number.isInteger(claims.id) || typeof claims.cs !== 'string') return null;

    const user = await User.findByPk(claims.id, { attributes: ['id', 'password'] });

    if (!user || !sameText(claims.cs, credentialStamp(user.password))) return null;

    return claims;
}

const jellyfinMac = (secret: string, userId: number, nonce: string, stamp: string): string =>
    createHmac('sha256', secret).update(`jellyfin:${userId}.${nonce}.${stamp}`).digest('base64url').slice(0, 32);

/**
 * A Jellyfin client access token. Jellyfin clients keep one token per device indefinitely, so these do
 * not expire; they are signed so they survive restarts, and die with a password change or user deletion.
 */
export function issueJellyfinToken(user: TokenUser, secret: string): string {
    const nonce = randomBytes(12).toString('base64url');

    return `${user.id.toString(36)}.${nonce}.${jellyfinMac(secret, user.id, nonce, credentialStamp(user.password))}`;
}

/** The user a Jellyfin token was issued to, or null when it is forged, stale or the user is gone. */
export async function verifyJellyfinToken(token: unknown, secret: string): Promise<User | null> {
    if (typeof token !== 'string') return null;

    const parts = token.split('.');

    if (parts.length !== 3) return null;

    const [encodedId, nonce, mac] = parts;
    const userId = parseInt(encodedId, 36);

    if (!Number.isSafeInteger(userId) || userId <= 0 || !nonce || !mac) return null;

    const user = await User.findByPk(userId);

    if (!user || !sameText(mac, jellyfinMac(secret, userId, nonce, credentialStamp(user.password)))) return null;

    return user;
}

function sameText(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    return left.length === right.length && timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}
