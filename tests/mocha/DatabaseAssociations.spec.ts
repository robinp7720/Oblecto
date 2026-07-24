import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// Regression test for a real bug: TrackMovie/TrackEpisode declare explicit
// lowercase `userId`/`movieId`/`episodeId` columns, but initAssociations()
// used to set up belongsTo()/hasMany() without a matching `foreignKey`, so
// Sequelize also auto-generated its own PascalCase FK columns (`UserId`,
// `MovieId`, `EpisodeId`). Those collided with the explicit lowercase ones
// at CREATE TABLE time (SQLite column names are case-insensitive), so a
// fresh `oblecto init` failed with "SQLITE_ERROR: duplicate column name".
//
// initDatabase() is a process-lifetime singleton whose initAssociations()
// mutates every shared model class the first time it's called - running it
// in-process here would permanently affect every other spec file in the
// same mocha run. So, as with the CLI script tests, this runs in a
// genuinely separate child process against a throwaway sqlite file.
describe('database association setup', function () {
    this.timeout(15000);

    let tmpDir: string;
    let dbPath: string;
    let driverPath: string;
    let outputPath: string;

    const repoRoot = path.resolve(__dirname, '..', '..');

    before(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oblecto-db-assoc-'));
        dbPath = path.join(tmpDir, 'database.sqlite');
        outputPath = path.join(tmpDir, 'result.json');

        const databaseModulePath = path.join(repoRoot, 'src/submodules/database.ts').split(path.sep).join('/');

        driverPath = path.join(tmpDir, 'driver.mts');
        fs.writeFileSync(driverPath, [
            `const { initDatabase } = await import(${JSON.stringify(databaseModulePath)});`,
            `const outputPath = ${JSON.stringify(outputPath)};`,
            'const fs = await import("node:fs");',
            'const sequelize = initDatabase();',
            'try {',
            '    await sequelize.sync({ force: true });',
            '    const [trackEpisodeCols] = await sequelize.query("PRAGMA table_info(TrackEpisodes)");',
            '    const [trackMovieCols] = await sequelize.query("PRAGMA table_info(TrackMovies)");',
            '    fs.writeFileSync(outputPath, JSON.stringify({',
            '        ok: true,',
            '        trackEpisodeColumns: trackEpisodeCols.map((c) => c.name),',
            '        trackMovieColumns: trackMovieCols.map((c) => c.name),',
            '    }));',
            '} catch (e) {',
            '    fs.writeFileSync(outputPath, JSON.stringify({ ok: false, error: e.message }));',
            '}',
            'await sequelize.close();'
        ].join('\n'));
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('syncs every model, including TrackMovie/TrackEpisode, without a duplicate-column error', () => {
        const configPath = path.join(tmpDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            database: { dialect: 'sqlite', storage: dbPath, username: '', password: '', database: 'test' },
            queue: { concurrency: 1 }
        }));

        const tsxBin = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
        execFileSync(tsxBin, [driverPath], {
            cwd: repoRoot,
            env: { ...process.env, OBLECTO_CONFIG_PATH: configPath },
            encoding: 'utf8'
        });

        const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

        assert.equal(result.ok, true, result.error);

        // Exactly one FK column per relation, matching the explicitly
        // declared lowercase names - no colliding PascalCase duplicate.
        assert.deepEqual(
            result.trackEpisodeColumns.filter((c: string) => c.toLowerCase() === 'userid'),
            ['userId']
        );
        assert.deepEqual(
            result.trackEpisodeColumns.filter((c: string) => c.toLowerCase() === 'episodeid'),
            ['episodeId']
        );
        assert.deepEqual(
            result.trackMovieColumns.filter((c: string) => c.toLowerCase() === 'userid'),
            ['userId']
        );
        assert.deepEqual(
            result.trackMovieColumns.filter((c: string) => c.toLowerCase() === 'movieid'),
            ['movieId']
        );
    });
});
