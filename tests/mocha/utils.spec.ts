
import expect from 'expect.js';
import { fileExists } from '../../src/submodules/utils.js';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('Utils', function () {
    const tempFile = path.resolve('temp_test_file.txt');

    before(async function() {
        await fs.writeFile(tempFile, 'test content');
    });

    after(async function() {
        try {
            await fs.unlink(tempFile);
        } catch (e) {
            // ignore
        }
    });

    it('should return true if file exists', async function () {
        const result = await fileExists(tempFile);
        expect(result).to.be(true);
    });

    it('should return false if file does not exist', async function () {
        const result = await fileExists('non_existent_file_12345.txt');
        expect(result).to.be(false);
    });
});
