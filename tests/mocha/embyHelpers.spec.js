import assert from 'node:assert/strict';
import { formatUuid, parseUuid } from '../../src/lib/embyEmulation/helpers.js';

describe('Emby Emulation Helpers', () => {
    describe('formatUuid', () => {
        it('should format a number to a valid UUID string', () => {
            const id = 1;
            const expected = '00000000-0000-0000-0000-000000000001';

            assert.strictEqual(formatUuid(id), expected);
        });

        it('should handle larger numbers correctly', () => {
            const id = 123456789;
            // 123456789 in hex is 75bcd15
            const expected = '00000000-0000-0000-0000-0000075bcd15';

            assert.strictEqual(formatUuid(id), expected);
        });
    });

    describe('parseUuid', () => {
        it('should parse a UUID string back to a number', () => {
            const uuid = '00000000-0000-0000-0000-000000000001';
            const expected = 1;

            assert.strictEqual(parseUuid(uuid), expected);
        });

        it('should parse a complex UUID string back to a number', () => {
            const uuid = '00000000-0000-0000-0000-0000075bcd15';
            const expected = 123456789;

            assert.strictEqual(parseUuid(uuid), expected);
        });
    });

    describe('Integration', () => {
        it('should cycle correctly', () => {
            const id = 9999;
            const uuid = formatUuid(id);
            const parsed = parseUuid(uuid);

            assert.strictEqual(parsed, id);
        });
    });
});
