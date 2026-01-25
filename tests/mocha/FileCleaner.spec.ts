
import expect from 'expect.js';
import { promises as fs } from 'fs';
import { File } from '../../src/models/file.js';
import FileCleaner from '../../src/lib/cleaners/FileCleaner.js';
import logger from '../../src/submodules/logger/index.js';
import Queue from '../../src/lib/queue/index.js';

describe('FileCleaner', function () {
    let fileCleaner: FileCleaner;
    let originalFindAll: any;
    let originalStat: any;

    const mockOblecto: any = {
        queue: new Queue(1)
    };

    before(function () {
        logger.silent = true;
    });

    after(function () {
        logger.silent = false;
    });

    beforeEach(function () {
        fileCleaner = new FileCleaner(mockOblecto);
        originalFindAll = File.findAll;
        originalStat = fs.stat;
    });

    afterEach(function () {
        // @ts-ignore
        File.findAll = originalFindAll;
        fs.stat = originalStat;
    });

    describe('removedDeletedFiled', function () {
        it('should remove files that do not exist on disk', async function () {
            const destroyedIds: number[] = [];
            
            const mockFiles = [
                {
                    id: 1,
                    path: '/exists/file.mkv',
                    destroy: async () => { destroyedIds.push(1); }
                },
                {
                    id: 2,
                    path: '/missing/file.mkv',
                    destroy: async () => { destroyedIds.push(2); }
                }
            ];

            // Mock File.findAll
            // @ts-ignore
            File.findAll = async () => mockFiles;

            // Mock fs.stat
            // @ts-ignore
            fs.stat = async (path: string) => {
                if (path.includes('missing')) {
                    throw new Error('File not found');
                }
                return {}; // Success
            };

            await fileCleaner.removedDeletedFiled();

            expect(destroyedIds).to.contain(2);
            expect(destroyedIds).to.not.contain(1);
        });
    });

    describe('removeAssoclessFiles', function () {
        it('should remove files with no movies or episodes', async function () {
            const destroyedIds: number[] = [];
            
            const mockFiles = [
                {
                    id: 1,
                    Movies: [{ id: 100 }], // Has movie
                    Episodes: [],
                    destroy: async () => { destroyedIds.push(1); }
                },
                {
                    id: 2,
                    Movies: [],
                    Episodes: [{ id: 200 }], // Has episode
                    destroy: async () => { destroyedIds.push(2); }
                },
                {
                    id: 3,
                    Movies: [],
                    Episodes: [], // Orphan
                    destroy: async () => { destroyedIds.push(3); }
                }
            ];

            // Mock File.findAll
            // @ts-ignore
            File.findAll = async () => mockFiles;

            await fileCleaner.removeAssoclessFiles();

            expect(destroyedIds).to.contain(3);
            expect(destroyedIds).to.not.contain(1);
            expect(destroyedIds).to.not.contain(2);
            expect(destroyedIds.length).to.be(1);
        });
    });
});
