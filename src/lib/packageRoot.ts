import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

type ReadFile = (path: string) => string;

const readText: ReadFile = path => readFileSync(path, 'utf8');

/**
 * The directory holding Oblecto's package.json, found by walking up from this module.
 * Works from src/ under tsx and from either esbuild bundle in dist/, whatever the working directory,
 * so a global npm install or a systemd unit can find the shipped web UI and images.
 */
export function findPackageRoot(
    moduleDirectory = dirname(fileURLToPath(import.meta.url)),
    read: ReadFile = readText
): string {
    let directory = resolve(moduleDirectory);

    for (;;) {
        try {
            const pkg = JSON.parse(read(join(directory, 'package.json'))) as { name?: unknown };

            if (pkg.name === 'oblecto') return directory;
        } catch {
            // No package.json here, or not ours: keep walking up.
        }

        const parent = dirname(directory);

        if (parent === directory) return process.cwd();
        directory = parent;
    }
}
