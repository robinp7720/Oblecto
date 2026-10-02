import MovieCleaner from '../../src/lib/cleaners/MovieCleaner.js';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { chooseSqliteDriver } from '../../src/submodules/sqliteDriver.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import { FederationRecord, federationRecordColumns } from '../../src/models/federationRecord.js';
import { applySnapshot, createSnapshot, snapshotPage, validateFile } from '../../src/lib/federation/catalog.js';
import FileCleaner from '../../src/lib/cleaners/FileCleaner.js';
import { randomUUID } from 'node:crypto';

export async function federationDatabase() {
    const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', dialectModule: chooseSqliteDriver().module, logging: false });
    for (const [model, columns, name] of [[File, fileColumns, 'File'], [Movie, movieColumns, 'Movie'], [Episode, episodeColumns, 'Episode'], [Series, seriesColumns, 'Series'], [MovieFiles, movieFileColumns, 'MovieFiles'], [EpisodeFiles, episodeFilesColumns, 'EpisodeFiles']] as const) model.init(columns as any, { sequelize: db, modelName: name });
    FederationRecord.init(federationRecordColumns, { sequelize: db, modelName: 'FederationRecord', timestamps: false });
    Episode.belongsTo(Series); Series.hasMany(Episode);
    Movie.belongsToMany(File, { through: MovieFiles }); File.belongsToMany(Movie, { through: MovieFiles });
    Episode.belongsToMany(File, { through: EpisodeFiles }); File.belongsToMany(Episode, { through: EpisodeFiles });
    await db.sync({ force: true }); return db;
}
const movieRecord = (id = '5') => ({ id, metadata: { duration: 42 }, movies: [{ id: '1', tmdbid: 50, movieName: 'Shared movie', overview: 'Visible without a provider' }], episodes: [] });
async function stage(files: unknown[]) {
    const id = randomUUID();
    for (const [index, file] of files.entries()) await FederationRecord.create({ scope: `import:${id}`, key: String(index).padStart(12, '0'), value: JSON.stringify(file), expires: Date.now() + 60000 });
    return id;
}
describe('Federation catalog snapshots', () => {
    let db: Sequelize;
    beforeEach(async () => { db = await federationDatabase(); });
    afterEach(async () => { await db.close(); });
    it('imports idempotently and refreshes remote file metadata', async () => {
        const file = movieRecord();
        await applySnapshot('origin', await stage([file]), 1, () => false);
        file.metadata.duration = 55; file.movies[0].movieName = 'Updated title';
        await applySnapshot('origin', await stage([file]), 1, () => false);
        assert.equal(await File.count(), 1); assert.equal(await Movie.count(), 1); assert.equal(await MovieFiles.count(), 1);
        assert.equal((await File.findOne())?.duration, 55);
        assert.equal((await Movie.findOne())?.movieName, 'Updated title');
        assert.equal((await Movie.findOne())?.overview, 'Visible without a provider');
    });
    it('does not overwrite a shared local title with peer metadata', async () => {
        await applySnapshot('origin', await stage([movieRecord()]), 1, () => false);
        const movie = (await Movie.findOne())!;
        await movie.update({ movieName: 'My local title' });
        const local = await File.create({ host: 'local', path: '/local' });
        await MovieFiles.create({ FileId: local.id, MovieId: movie.id });
        await applySnapshot('origin', await stage([movieRecord()]), 1, () => false);
        assert.equal((await movie.reload()).movieName, 'My local title');
    });
    it('links existing episodes and preserves all associations', async () => {
        const series = await Series.create({ tvdbid: 3 });
        const episode = await Episode.create({ SeriesId: series.id, airedSeason: '1', airedEpisodeNumber: '2' });
        const file = { id: '10', metadata: {}, movies: [], episodes: [{ id: '20', metadata: { airedSeason: '1', airedEpisodeNumber: '2' }, series: { id: '4', tvdbid: 3 } }, { id: '21', metadata: { airedSeason: '1', airedEpisodeNumber: '3' }, series: { id: '4', tvdbid: 3 } }] };
        await applySnapshot('origin', await stage([file]), 1, () => false);
        assert.equal(await Episode.count(), 2); assert.equal(await EpisodeFiles.count(), 2);
        assert.ok(await EpisodeFiles.findOne({ where: { EpisodeId: episode.id } }));
    });
    it('keeps unmatched media identities separate per peer', async () => {
        const file = movieRecord(); delete (file.movies[0] as any).tmdbid;
        await applySnapshot('a', await stage([file]), 1, () => false);
        await applySnapshot('b', await stage([file]), 1, () => false);
        await applySnapshot('a', await stage([file]), 1, () => false);
        assert.equal(await Movie.count(), 2);
    });
    it('retains historical identities when a provider match changes', async () => {
        const file = movieRecord(); delete (file.movies[0] as any).tmdbid;
        await applySnapshot('origin', await stage([file]), 1, () => false);
        await Movie.create({ tmdbid: 50, movieName: 'Provider match' });
        await applySnapshot('origin', await stage([movieRecord()]), 1, () => false);
        await applySnapshot('origin', await stage([]), 0, () => false);
        await new MovieCleaner({} as any).removeFileLessMovies();
        assert.equal(await Movie.count(), 2);
    });
    it('reconciles deletions only after a complete valid snapshot', async () => {
        await File.create({ host: 'local', path: '/local', name: 'local' });
        await applySnapshot('origin', await stage([movieRecord()]), 1, () => false);
        await assert.rejects(applySnapshot('origin', await stage([]), 1, () => false), /Incomplete/);
        await assert.rejects(applySnapshot('origin', await stage([movieRecord('6'), { broken: true }]), 2, () => false));
        assert.equal(await File.count({ where: { host: 'origin' } }), 1);
        await assert.rejects(applySnapshot('origin', await stage([]), 0, () => true), /cancelled/);
        await applySnapshot('origin', await stage([]), 0, () => false);
        assert.equal(await File.count(), 1); assert.equal(await Movie.count(), 1);
        await new MovieCleaner({} as any).removeFileLessMovies();
        assert.equal(await Movie.count(), 1);
    });
    it('exports only local files without filesystem paths and retains every association', async () => {
        const movie = await Movie.create({ tmdbid: 1, movieName: 'Local' });
        const local = await File.create({ host: 'local', path: '/secret/movie.mp4', name: 'movie', duration: 10 });
        await MovieFiles.create({ MovieId: movie.id, FileId: local.id });
        await applySnapshot('remote', await stage([movieRecord()]), 1, () => false);
        const snapshot = await createSnapshot(); const page = await snapshotPage(snapshot.snapshot, 0);
        assert.equal(snapshot.count, 1); assert.equal(page.length, 1);
        assert.ok(!JSON.stringify(page).includes('/secret/')); assert.equal(validateFile(page[0]).movies[0].movieName, 'Local');
    });
    it('does not filesystem-clean remote file IDs', async () => {
        await applySnapshot('remote', await stage([movieRecord()]), 1, () => false);
        await new FileCleaner({ config: { movies: { directories: [] }, tvshows: { directories: [] } } } as any).removedDeletedFiled();
        assert.equal(await File.count(), 1);
    });
    it('rejects malformed and ambiguous metadata before indexing', () => {
        assert.throws(() => validateFile({ ...movieRecord(), id: '../../etc/passwd' }));
        assert.throws(() => validateFile({ ...movieRecord(), movies: [{ id: '1', tmdbid: -1 }] }));
        assert.throws(() => validateFile({ ...movieRecord(), movies: [], episodes: [] }));
    });
});
