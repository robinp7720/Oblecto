import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPackageRoot } from '../../src/lib/packageRoot.js';

const tree = (files: Record<string, string>) => (path: string): string => {
    if (!(path in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return files[path];
};

describe('findPackageRoot', () => {
    const files = {
        '/usr/lib/node_modules/oblecto/package.json': JSON.stringify({ name: 'oblecto' }),
        '/usr/lib/node_modules/oblecto/Oblecto-Web/package.json': JSON.stringify({ name: 'Oblecto-Web' })
    };

    it('finds the package from the CLI bundle of a global install', () => {
        assert.equal(findPackageRoot('/usr/lib/node_modules/oblecto/dist/bin', tree(files)), '/usr/lib/node_modules/oblecto');
    });

    it('finds the package from the server bundle', () => {
        assert.equal(findPackageRoot('/usr/lib/node_modules/oblecto/dist', tree(files)), '/usr/lib/node_modules/oblecto');
    });

    it('skips package.json files that belong to something else', () => {
        assert.equal(findPackageRoot('/usr/lib/node_modules/oblecto/Oblecto-Web/src', tree(files)), '/usr/lib/node_modules/oblecto');
    });

    it('finds this checkout from source', () => {
        const root = findPackageRoot();

        assert.equal((JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string }).name, 'oblecto');
        assert.ok(existsSync(join(root, 'src/lib/packageRoot.ts')));
    });
});
