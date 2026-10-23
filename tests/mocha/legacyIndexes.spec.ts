import assert from 'node:assert/strict';
import type { QueryInterface } from 'sequelize';
import { removeDuplicateLegacyIndexes, isIndexLimitError } from '../../src/submodules/migrations/legacyIndexes.js';
import { MIGRATIONS } from '../../src/submodules/migrations/index.js';

const canonical = { name: 'tmdbid', unique: true, primary: false, type: 'BTREE', fields: [{ attribute: 'tmdbid', order: 'ASC', length: undefined as number | undefined }] };

describe('Legacy MySQL provider-id indexes', () => {
    it('removes only numbered exact duplicates while retaining uniqueness and distinct indexes', async () => {
        const indexes = [
            canonical,
            { ...canonical, name: 'tmdbid_2' },
            { ...canonical, name: 'tmdbid_3', fields: [{ ...canonical.fields[0], length: 8 }] },
            { ...canonical, name: 'tmdbid_4', fields: [{ ...canonical.fields[0], order: 'DESC' }] },
            { ...canonical, name: 'tmdbid_5', unique: false },
            { ...canonical, name: 'tmdbid_6', type: 'HASH' },
            { ...canonical, name: 'tmdbid_7', fields: [...canonical.fields, { attribute: 'id', order: 'ASC', length: undefined }] },
            { ...canonical, name: 'custom_provider_lookup' },
            { ...canonical, name: 'imdbid_2', fields: [{ attribute: 'imdbid', order: 'ASC', length: undefined }] }
        ];
        const removed: string[] = [];
        const query = {
            sequelize: { getDialect: () => 'mysql' },
            showIndex: async () => indexes,
            removeIndex: async (_table: string, name: string) => { removed.push(name); }
        } as unknown as QueryInterface;
        assert.equal(await removeDuplicateLegacyIndexes(query, 'Series'), 1);
        assert.deepEqual(removed, ['tmdbid_2']);
        assert.equal(await removeDuplicateLegacyIndexes(query, 'Users'), 0);
        query.sequelize.getDialect = () => 'sqlite';
        assert.equal(await removeDuplicateLegacyIndexes(query, 'Series'), 0);
        assert.deepEqual(removed, ['tmdbid_2']);
    });

    it('recovers migration 0015 on a table already at the MySQL key limit and safely reruns', async () => {
        let indexes = [canonical, ...Array.from({ length: 63 }, (_, i) => ({ ...canonical, name: `tmdbid_${i + 2}` }))];
        let failures = 0;
        const query = {
            sequelize: { getDialect: () => 'mysql' },
            showAllTables: async () => ['Series'],
            showIndex: async () => indexes,
            removeIndex: async (_table: string, name: string) => { indexes = indexes.filter(index => index.name !== name); },
            addIndex: async (_table: string, fields: string[], options: { name: string; unique: boolean }) => {
                if (indexes.length >= 64) { failures++; throw { original: { code: 'ER_TOO_MANY_KEYS' } }; }
                indexes.push({ ...canonical, name: options.name, unique: options.unique, fields: fields.map(attribute => ({ attribute, order: 'ASC', length: undefined })) });
            }
        };
        const context = { sequelize: query.sequelize, queryInterface: query } as never;
        const migration = MIGRATIONS.find(entry => entry.name === '0015-browse-indexes')!;
        await migration.up(context);
        assert.equal(failures, 1);
        assert.equal(indexes.length, 6);
        assert.ok(indexes.some(index => index.name === 'tmdbid' && index.unique));
        assert.ok(indexes.some(index => index.name === 'Series_createdAt_id'));
        await migration.up(context);
        assert.equal(indexes.length, 6);
        assert.equal(failures, 1);
    });

    it('distinguishes index capacity from unrelated database errors', () => {
        assert.equal(isIndexLimitError({ parent: { code: 'ER_TOO_MANY_KEYS' } }), true);
        assert.equal(isIndexLimitError({ original: { code: 'ER_DUP_ENTRY' } }), false);
        assert.equal(isIndexLimitError(null), false);
    });
});
