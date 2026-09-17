import assert from 'node:assert/strict';
import { resolveJellyfinWebPath } from '../../src/lib/embyEmulation/ServerAPI/webPath.js';

describe('Jellyfin web path resolution', () => {
    it('finds the copied frontend beside the main server bundle', () => {
        const expected = '/opt/oblecto/dist/jellyfin-web';
        const actual = resolveJellyfinWebPath('/opt/oblecto/dist', path => path === `${expected}/index.html`);

        assert.equal(actual, expected);
    });

    it('finds the copied frontend from the CLI bundle', () => {
        const expected = '/opt/oblecto/dist/jellyfin-web';
        const actual = resolveJellyfinWebPath('/opt/oblecto/dist/bin', path => path === `${expected}/index.html`);

        assert.equal(actual, expected);
    });

    it('finds the submodule build in source development', () => {
        const expected = '/opt/oblecto/jellyfin-web/dist';
        const actual = resolveJellyfinWebPath(
            '/opt/oblecto/src/lib/embyEmulation/ServerAPI',
            path => path === `${expected}/index.html`
        );

        assert.equal(actual, expected);
    });
});
