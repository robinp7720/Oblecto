import cors from 'cors';
import type { RequestHandler } from 'express';

type CorsSettings = { corsOrigins?: string[] };

/**
 * Cross-origin access only for origins listed in server.corsOrigins ("*" for any). Pages served by
 * Oblecto itself are same-origin and need nothing here. Allowing every origin would let any website
 * a user on the local network visits sign in as an account allowed to skip its password.
 * @param settings - The server section, read on every request so settings changes apply at once
 * @param headers - The request and response headers the API uses
 */
export function corsFor(settings: () => CorsSettings | undefined, headers: { allowed: string[]; exposed: string[] }): RequestHandler {
    return cors((req, callback) => {
        const origin = req.headers.origin;
        const allowed = settings()?.corsOrigins ?? [];
        const permitted = origin !== undefined && (allowed.includes('*') || allowed.includes(origin));

        callback(null, {
            origin: permitted ? origin : false,
            maxAge: 600,
            allowedHeaders: headers.allowed,
            exposedHeaders: headers.exposed
        });
    });
}
