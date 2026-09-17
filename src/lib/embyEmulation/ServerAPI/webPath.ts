import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

type PathExists = (path: string) => boolean;

/**
 * Locate the Jellyfin web build in development and in either bundled entrypoint.
 * esbuild preserves import.meta.url from the entrypoint, so a production bundle
 * can run from dist/index.js or dist/bin/oblecto.js.
 */
export function resolveJellyfinWebPath(
    moduleDirectory = dirname(fileURLToPath(import.meta.url)),
    pathExists: PathExists = existsSync
): string {
    const candidates = [
        resolve(moduleDirectory, 'jellyfin-web'),
        resolve(moduleDirectory, '../jellyfin-web'),
        resolve(moduleDirectory, '../../../../jellyfin-web/dist')
    ];

    return candidates.find(candidate => pathExists(resolve(candidate, 'index.html'))) ?? candidates[0];
}
