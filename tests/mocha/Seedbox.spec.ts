import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Sequelize } from 'sequelize';

import Seedbox from '../../src/lib/seedbox/Seedbox.js';
import SeedboxController from '../../src/lib/seedbox/SeedboxController.js';
import SeedboxImportDriver from '../../src/lib/seedbox/SeedboxImportDriver.js';
import SeedboxImportFTPS from '../../src/lib/seedbox/SeedboxImportDrivers/SeedboxImportFTPS.js';
import SeedboxImportSSH from '../../src/lib/seedbox/SeedboxImportDrivers/SeedboxImportSSH.js';
import WarnExtendableError from '../../src/lib/errors/WarnExtendableError.js';
import { File, fileColumns } from '../../src/models/file.js';
import logger from '../../src/submodules/logger/index.js';

import type { SeedboxListEntry } from '../../src/lib/seedbox/SeedboxImportDriver.js';
import type Oblecto from '../../src/lib/oblecto/index.js';

const baseSeedboxConfig = (overrides: Record<string, any> = {}) => ({
    name: 'myseedbox',
    storageDriver: 'ftp',
    storageDriverOptions: { host: 'h', username: 'u', password: 'p' },
    mediaImport: { movieDirectory: '/remote/movies', seriesDirectory: '/remote/series' },
    ...overrides
});

describe('Seedbox', () => {
    before(() => { logger.silent = true; });
    after(() => { logger.silent = false; });

    describe('initStorageDriver', () => {
        it('selects the FTPS driver for ftp/ftps', () => {
            assert.ok(new Seedbox(baseSeedboxConfig({ storageDriver: 'ftp' })).storageDriver instanceof SeedboxImportFTPS);
            assert.ok(new Seedbox(baseSeedboxConfig({ storageDriver: 'FTPS' })).storageDriver instanceof SeedboxImportFTPS);
        });

        it('selects the SSH driver for sftp/ssh', () => {
            assert.ok(new Seedbox(baseSeedboxConfig({ storageDriver: 'sftp' })).storageDriver instanceof SeedboxImportSSH);
            assert.ok(new Seedbox(baseSeedboxConfig({ storageDriver: 'SSH' })).storageDriver instanceof SeedboxImportSSH);
        });

        it('returns a WarnExtendableError instance for an unknown driver name', () => {
            const seedbox = new Seedbox(baseSeedboxConfig({ storageDriver: 'bogus' }));
            assert.ok(seedbox.storageDriver instanceof WarnExtendableError);
        });

        it('normalizes the configured movie/series paths', () => {
            const seedbox = new Seedbox(baseSeedboxConfig({ mediaImport: { movieDirectory: '/a/b/../c', seriesDirectory: '/x//y' } }));
            assert.equal(seedbox.moviePath, path.normalize('/a/c'));
            assert.equal(seedbox.seriesPath, path.normalize('/x/y'));
        });
    });

    describe('findAll', () => {
        it('recursively walks directories and collects files matching the given extensions', async () => {
            const seedbox = new Seedbox(baseSeedboxConfig());

            const tree: Record<string, SeedboxListEntry[]> = {
                '/remote/movies': [
                    { name: 'movie.mkv', type: 0 },
                    { name: 'sub', type: 1 },
                    { name: 'readme.txt', type: 0 }
                ],
                '/remote/movies/sub': [
                    { name: 'movie2.mp4', type: 0 }
                ]
            };

            seedbox.storageDriver.list = async (dir: string) => tree[dir] || [];

            const files = await seedbox.findAll('/remote/movies', ['mkv', 'mp4']);

            assert.deepEqual(files.sort(), [
                path.normalize('/remote/movies/movie.mkv'),
                path.normalize('/remote/movies/sub/movie2.mp4')
            ].sort());
        });

        it('continues past a directory that fails to list', async () => {
            const seedbox = new Seedbox(baseSeedboxConfig());

            seedbox.storageDriver.list = async (dir: string) => {
                if (dir === '/remote/movies') throw new Error('connection reset');
                return [];
            };

            const files = await seedbox.findAll('/remote/movies', ['mkv']);
            assert.deepEqual(files, []);
        });
    });
});

describe('SeedboxImportDriver base class', () => {
    it('setup/list/copy are safe no-ops by default', async () => {
        const driver = new SeedboxImportDriver({ host: 'h', username: 'u', password: 'p' });

        await driver.setup();
        assert.deepEqual(await driver.list('/x'), []);
        await driver.copy('/a', '/b');
    });
});

describe('SeedboxImportFTPS.list', () => {
    it('maps basic-ftp entry types to the internal type numbering', async () => {
        const driver = new SeedboxImportFTPS({ host: 'h', username: 'u', password: 'p' });
        driver.client.list = (async () => ([
            { name: 'file.mkv', type: 1 },
            { name: 'folder', type: 2 }
        ])) as any;

        const entries = await driver.list('/x');

        assert.deepEqual(entries, [
            { name: 'file.mkv', type: 0 },
            { name: 'folder', type: 1 }
        ]);
    });
});

describe('SeedboxImportSSH.list', () => {
    it('maps ssh2-sftp-client entry types to the internal type numbering', async () => {
        const driver = new SeedboxImportSSH({ host: 'h', username: 'u', password: 'p' });
        (driver.client as any).list = async () => ([
            { name: 'file.mkv', type: '-' },
            { name: 'folder', type: 'd' }
        ]);

        const entries = await driver.list('/x');

        assert.deepEqual(entries, [
            { name: 'file.mkv', type: 0 },
            { name: 'folder', type: 1 }
        ]);
    });
});

describe('SeedboxController', () => {
    let sequelize: Sequelize;
    let tmpDir: string;

    before(async () => {
        logger.silent = true;
        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        await sequelize.sync({ force: true });
    });

    after(() => { logger.silent = false; });

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-seedbox-'));
        await File.destroy({ where: {}, truncate: true });
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    const makeOblecto = (overrides: Record<string, any> = {}) => ({
        config: {
            seedboxImport: { concurrency: 1 },
            seedboxes: [],
            fileExtensions: { video: ['mkv', 'mp4'] },
            movies: { directories: [{ path: '/library/movies' }] },
            tvshows: { directories: [{ path: '/library/series' }] }
        },
        realTimeController: { broadcast: () => {} },
        ...overrides
    }) as unknown as Oblecto;

    it('importFile downloads to a temp suffix then renames it into place, broadcasting progress', async () => {
        const events: any[] = [];
        const oblecto = makeOblecto({ realTimeController: { broadcast: (channel: string, payload: any) => events.push(payload) } });
        const controller = new SeedboxController(oblecto);

        const dest = path.join(tmpDir, 'nested', 'movie.mkv');
        const seedbox = { name: 'sb1', storageDriver: { copy: async (origin: string, to: string) => { await fs.writeFile(to, 'data'); } } } as any;

        await controller.importFile(seedbox, '/remote/movie.mkv', dest);

        const content = await fs.readFile(dest, 'utf8');
        assert.equal(content, 'data');

        const eventTypes = events.map(e => e.event);
        assert.deepEqual(eventTypes, ['import_start', 'import_success']);
    });

    it('importFile broadcasts import_error and leaves no destination file when the copy fails', async () => {
        const events: any[] = [];
        const oblecto = makeOblecto({ realTimeController: { broadcast: (channel: string, payload: any) => events.push(payload) } });
        const controller = new SeedboxController(oblecto);

        const dest = path.join(tmpDir, 'movie.mkv');
        const seedbox = { name: 'sb1', storageDriver: { copy: async () => { throw new Error('connection lost'); } } } as any;

        await controller.importFile(seedbox, '/remote/movie.mkv', dest);

        const eventTypes = events.map(e => e.event);
        assert.deepEqual(eventTypes, ['import_start', 'import_error']);
        await assert.rejects(() => fs.access(dest));
    });

    it('importMovie downloads the file then hands it to the movie collector', async () => {
        const collected: string[] = [];
        const oblecto = makeOblecto({ movieCollector: { collectFile: (p: string) => collected.push(p) } });
        const controller = new SeedboxController(oblecto);

        const dest = path.join(tmpDir, 'movie.mkv');
        const seedbox = { name: 'sb1', storageDriver: { copy: async (o: string, to: string) => { await fs.writeFile(to, 'x'); } } } as any;

        await controller.importMovie(seedbox, '/remote/movie.mkv', dest);

        assert.deepEqual(collected, [dest]);
    });

    it('importEpisode downloads the file then hands it to the series collector', async () => {
        const collected: string[] = [];
        const oblecto = makeOblecto({ seriesCollector: { collectFile: (p: string) => collected.push(p) } });
        const controller = new SeedboxController(oblecto);

        const dest = path.join(tmpDir, 'ep.mkv');
        const seedbox = { name: 'sb1', storageDriver: { copy: async (o: string, to: string) => { await fs.writeFile(to, 'x'); } } } as any;

        await controller.importEpisode(seedbox, '/remote/ep.mkv', dest);

        assert.deepEqual(collected, [dest]);
    });

    it('fileAlreadyImported checks by parsed file name', async () => {
        const controller = new SeedboxController(makeOblecto());

        await File.create({ name: 'movie', path: '/x/movie.mkv' });

        assert.equal(await controller.fileAlreadyImported('/anywhere/movie.mkv'), true);
        assert.equal(await controller.fileAlreadyImported('/anywhere/other.mkv'), false);
    });

    it('shouldImportMovie/shouldImportEpisode defer to fileAlreadyImported', async () => {
        const controller = new SeedboxController(makeOblecto());
        await File.create({ name: 'existing', path: '/x/existing.mkv' });

        assert.equal(await controller.shouldImportMovie('/x/existing.mkv', {}), false);
        assert.equal(await controller.shouldImportMovie('/x/new.mkv', {}), true);
        assert.equal(await controller.shouldImportEpisode('/x/existing.mkv'), false);
        assert.equal(await controller.shouldImportEpisode('/x/new.mkv'), true);
    });

    it('alreadyImportingFile reflects jobs currently queued for import', () => {
        const controller = new SeedboxController(makeOblecto());

        controller.importQueue.pushJob('importMovie', { origin: '/x/inflight.mkv' });

        assert.equal(controller.alreadyImportingFile('/x/inflight.mkv'), true);
        assert.equal(controller.alreadyImportingFile('/x/other.mkv'), false);
    });

    it('addSeedbox sets up the driver and registers the seedbox', async () => {
        const originalSetup = SeedboxImportFTPS.prototype.setup;
        let setupCalled = false;
        SeedboxImportFTPS.prototype.setup = async function () { setupCalled = true; };

        try {
            const controller = new SeedboxController(makeOblecto());
            await controller.addSeedbox(baseSeedboxConfig({ storageDriver: 'ftp' }));

            assert.equal(controller.seedBoxes.length, 1);
            assert.equal(controller.seedBoxes[0].name, 'myseedbox');
            assert.equal(setupCalled, true);
        } finally {
            SeedboxImportFTPS.prototype.setup = originalSetup;
        }
    });

    it('importMovies skips sample files, already-importing files, and already-imported files', async () => {
        const matched: string[] = [];
        const oblecto = makeOblecto({
            movieIndexer: { matchFile: async (file: string) => { matched.push(file); return { tmdbid: 1, movieName: 'X' }; } },
            movieUpdater: { aggregateMovieUpdateRetriever: { retrieveInformation: async () => ({ releaseDate: '2020-05-01' }) } }
        });
        const controller = new SeedboxController(oblecto);

        await File.create({ name: 'already-imported', path: '/x/already-imported.mkv' });

        const seedbox = new Seedbox(baseSeedboxConfig());
        seedbox.storageDriver.list = async (dir: string) => {
            if (dir === seedbox.moviePath) {
                return [
                    { name: 'movie.sample.mkv', type: 0 },
                    { name: 'already-imported.mkv', type: 0 },
                    { name: 'new-movie.mkv', type: 0 }
                ];
            }
            return [];
        };

        const pushedJobs: any[] = [];
        controller.importQueue.pushJob = ((id: string, attr: any) => pushedJobs.push({ id, attr })) as any;

        await controller.importMovies(seedbox);

        assert.deepEqual(matched, [path.normalize(`${seedbox.moviePath}/new-movie.mkv`)]);
        assert.equal(pushedJobs.length, 1);
        assert.equal(pushedJobs[0].id, 'importMovie');
        assert.ok(pushedJobs[0].attr.destination.includes('X (2020)'));
    });

    it('importEpisodes uses the series indexer and pushes an importEpisode job', async () => {
        const oblecto = makeOblecto({
            seriesIndexer: { identify: async () => ({ series: { seriesName: 'Stargirl' } }) }
        });
        const controller = new SeedboxController(oblecto);

        const seedbox = new Seedbox(baseSeedboxConfig());
        seedbox.storageDriver.list = async (dir: string) => {
            if (dir === seedbox.seriesPath) return [{ name: 'ep.mkv', type: 0 }];
            return [];
        };

        const pushedJobs: any[] = [];
        controller.importQueue.pushJob = ((id: string, attr: any) => pushedJobs.push({ id, attr })) as any;

        await controller.importEpisodes(seedbox);

        assert.equal(pushedJobs.length, 1);
        assert.equal(pushedJobs[0].id, 'importEpisode');
        assert.ok(pushedJobs[0].attr.destination.includes('Stargirl'));
    });

    it('importEpisodes skips files that cannot be identified', async () => {
        const oblecto = makeOblecto({
            seriesIndexer: { identify: async () => { throw new Error('unidentifiable'); } }
        });
        const controller = new SeedboxController(oblecto);

        const seedbox = new Seedbox(baseSeedboxConfig());
        seedbox.storageDriver.list = async (dir: string) => {
            if (dir === seedbox.seriesPath) return [{ name: 'ep.mkv', type: 0 }];
            return [];
        };

        const pushedJobs: any[] = [];
        controller.importQueue.pushJob = ((id: string, attr: any) => pushedJobs.push({ id, attr })) as any;

        await controller.importEpisodes(seedbox);

        assert.equal(pushedJobs.length, 0);
    });
});
