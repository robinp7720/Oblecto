import type { NextFunction, Response } from 'express';
import type EmbyEmulation from '../index.js';
import type { EmbyRequest } from './index.js';
import { getEmbyToken } from './requestUtils.js';
import { formatUuid } from '../helpers.js';

// Reachable before sign-in, as on a real Jellyfin server: discovery, sign-in, branding, localisation
// and item images, which clients load with plain <img> tags. Paths are already lower-cased.
const PUBLIC_ROUTES: RegExp[] = [
    /^\/?$/,
    /^\/system\/info\/public$/,
    /^\/system\/ping$/,
    /^\/users\/(public|authenticatebyname|forgotpassword|forgotpassword\/pin)$/,
    /^\/quickconnect\//,
    /^\/branding\//,
    /^\/localization\//,
    /^\/getutctime$/,
    /^\/(items|users|genres|musicgenres|artists|persons|studios)\/[^/]+\/images(\/|$)/,
    // Scoped media URLs carry their own playback token
    /^\/playback\/media\//,
    /^\/web(\/|$)/,
    /^\/socket(\/|$)/
];

export const isPublicRoute = (path: string): boolean => PUBLIC_ROUTES.some(route => route.test(path));

const USER_SEGMENT = /^\/users\/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/;

/**
 * Point every user id a request carries (the /users/{id} path segment, a UserId query or body field)
 * at the signed-in user. Handlers read those ids, so a client can only ever read or change its own
 * watch state and settings, whatever id it sends.
 */
export function pinToUser(req: EmbyRequest, userId: number): void {
    const uuid = formatUuid(userId);
    const split = req.url.indexOf('?');
    const path = (split === -1 ? req.url : req.url.slice(0, split)).replace(USER_SEGMENT, `/users/${uuid}`);
    let search = split === -1 ? '' : req.url.slice(split + 1);

    if (/(^|&)userid=/i.test(search)) {
        const params = new URLSearchParams(search);

        for (const key of [...params.keys()]) if (key.toLowerCase() === 'userid') params.set(key, uuid);
        search = params.toString();
    }

    req.url = search ? `${path}?${search}` : path;

    if (req.body !== null && typeof req.body === 'object') {
        const body = req.body as Record<string, unknown>;

        for (const key of Object.keys(body)) if (key.toLowerCase() === 'userid') body[key] = uuid;
    }
}

/** Rejects requests without a valid session with 401, as Jellyfin does. */
export function sessionGuard(emby: EmbyEmulation) {
    return (req: EmbyRequest, res: Response, next: NextFunction): void => {
        if (isPublicRoute(req.path)) return next();

        const token = getEmbyToken(req);

        emby.resolveSession(token).then(session => {
            if (!session || !token) {
                res.status(401).send('Unauthorized');
                return;
            }

            req.embyToken = token;
            req.embyUserId = session.Id;
            pinToUser(req, session.Id);
            next();
        }).catch(next);
    };
}
