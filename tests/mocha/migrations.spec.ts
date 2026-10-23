import { initStatisticsModels } from '../../src/models/statistics.js';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { DataTypes, Sequelize } from 'sequelize';
import { MIGRATIONS, migrate, pendingMigrations } from '../../src/submodules/migrations/index.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { SeriesSet, seriesSetColumns } from '../../src/models/seriesSet.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { Person, personColumns } from '../../src/models/person.js';
import { MovieCredit, movieCreditColumns } from '../../src/models/movieCredit.js';
import { SeriesCredit, seriesCreditColumns } from '../../src/models/seriesCredit.js';
import { EpisodeCredit, episodeCreditColumns } from '../../src/models/episodeCredit.js';
import { UserFavourite, userFavouriteColumns } from '../../src/models/userFavourite.js';
import { UserSeriesWatchlist, userSeriesWatchlistColumns } from '../../src/models/userSeriesWatchlist.js';
import { UserWatchlist, userWatchlistColumns } from '../../src/models/userWatchlist.js';
import { JellyfinDisplayPreferences, jellyfinDisplayPreferencesColumns } from '../../src/models/jellyfinDisplayPreferences.js';

// A throwaway database with the models the migrations touch registered on it.
async function database(): Promise<Sequelize> {
    const sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

    initStatisticsModels(sequelize);
    User.init(userColumns, { sequelize, modelName: 'User' });
    Group.init(groupColumns, { sequelize, modelName: 'Group' });
    File.init(fileColumns, { sequelize, modelName: 'File' });
    Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
    Series.init(seriesColumns, { sequelize, modelName: 'Series' });
    SeriesSet.init(seriesSetColumns, { sequelize, modelName: 'SeriesSet' });
    Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
    TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
    TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
    Person.init(personColumns, { sequelize, modelName: 'Person' });
    MovieCredit.init(movieCreditColumns, { sequelize, modelName: 'MovieCredit' });
    SeriesCredit.init(seriesCreditColumns, { sequelize, modelName: 'SeriesCredit' });
    EpisodeCredit.init(episodeCreditColumns, { sequelize, modelName: 'EpisodeCredit' });
    UserFavourite.init(userFavouriteColumns, { sequelize, modelName: 'UserFavourite' });
    UserSeriesWatchlist.init(userSeriesWatchlistColumns, { sequelize, modelName: 'UserSeriesWatchlist' });
    UserWatchlist.init(userWatchlistColumns, { sequelize, modelName: 'UserWatchlist' });
    JellyfinDisplayPreferences.init(jellyfinDisplayPreferencesColumns, { sequelize, modelName: 'JellyfinDisplayPreferences' });

    return sequelize;
}

const columns = async (sequelize: Sequelize, table: string): Promise<string[]> => Object.keys(await sequelize.getQueryInterface().describeTable(table));

describe('Database migrations', () => {
    it('adds browse indexes to existing data and refreshes SQLite statistics idempotently', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const movie = await Movie.create({ movieName: 'Keep this movie' });
            await TrackMovie.bulkCreate([0.2, 0.7].map(progress => ({ userId: 1, movieId: movie.id, progress })));
            await sequelize.getQueryInterface().removeIndex('TrackMovies', 'TrackMovies_userId_movieId_progress');
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0015-browse-indexes'");
            assert.deepEqual(await migrate(sequelize), ['0015-browse-indexes']);
            const names = (await sequelize.getQueryInterface().showIndex('TrackMovies') as Array<{ name: string }>).map(index => index.name);
            assert.ok(names.includes('TrackMovies_userId_movieId_progress'));
            const [statistics] = await sequelize.query("SELECT stat FROM sqlite_stat1 WHERE idx = 'TrackMovies_userId_movieId_progress'");
            assert.equal(statistics.length, 1);
            assert.equal(await TrackMovie.count(), 2, 'existing duplicate progress rows are preserved');
            assert.equal((await movie.reload()).movieName, 'Keep this movie');
            assert.deepEqual(await migrate(sequelize), []);
        } finally { await sequelize.close(); }
    });
    it('upgrades series caches and private watchlists without losing show data, and safely reruns', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const series = await Series.create({ seriesName: 'Existing show' });
            const user = await User.create({ username: 'tv-viewer' });
            const query = sequelize.getQueryInterface();
            await query.dropTable('UserSeriesWatchlists');
            for (const column of ['trailers', 'certifications', 'episodeCatalog', 'trailersUpdatedAt', 'certificationsUpdatedAt', 'catalogUpdatedAt']) await query.removeColumn('Series', column);
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0014-series-details'");
            assert.deepEqual(await migrate(sequelize), ['0014-series-details']);
            await series.reload();
            assert.equal(series.seriesName, 'Existing show');
            assert.equal(series.episodeCatalog, null);
            await series.update({ episodeCatalog: { episodes: [] }, certifications: [{ country: 'DE', certification: '12' }] });
            await series.reload();
            assert.deepEqual(series.episodeCatalog, { episodes: [] });
            await UserSeriesWatchlist.create({ userId: user.id, seriesId: series.id });
            await assert.rejects(UserSeriesWatchlist.create({ userId: user.id, seriesId: series.id }));
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0014-series-details'");
            assert.deepEqual(await migrate(sequelize), ['0014-series-details']);
            assert.equal(await UserSeriesWatchlist.count(), 1);
            await series.destroy();
            assert.equal(await UserSeriesWatchlist.count(), 0);
        } finally { await sequelize.close(); }
    });

    it('adds movie extras and private watchlists to an old database without changing existing movies', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const movie = await Movie.create({ movieName: 'Existing movie', siteRating: 8 });
            const user = await User.create({ username: 'viewer' });
            const query = sequelize.getQueryInterface();
            await query.dropTable('UserWatchlists');
            for (const column of ['trailers', 'certifications', 'trailersUpdatedAt', 'certificationsUpdatedAt']) await query.removeColumn('Movies', column);
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0013-movie-details'");
            assert.deepEqual(await migrate(sequelize), ['0013-movie-details']);
            await movie.reload();
            assert.equal(movie.movieName, 'Existing movie');
            assert.equal(movie.siteRating, 8);
            assert.equal(movie.trailers, null);
            assert.equal(movie.certifications, null);
            await movie.update({ trailers: [], certifications: [{ country: 'US', certification: 'PG-13' }] });
            await movie.reload();
            assert.deepEqual(movie.trailers, []);
            assert.deepEqual(movie.toJSON().certifications, [{ country: 'US', certification: 'PG-13' }]);
            await UserWatchlist.create({ userId: user.id, movieId: movie.id });
            await assert.rejects(UserWatchlist.create({ userId: user.id, movieId: movie.id }));
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0013-movie-details'");
            assert.deepEqual(await migrate(sequelize), ['0013-movie-details']);
            assert.equal(await UserWatchlist.count(), 1);
            await movie.destroy();
            assert.equal(await UserWatchlist.count(), 0);
            assert.deepEqual(await migrate(sequelize), []);
        } finally { await sequelize.close(); }
    });

    it('adds statistics tables to older databases and preserves them on repeated migration', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const query = sequelize.getQueryInterface();
            for (const table of ['ViewingDays', 'ViewingSessions', 'PlaybackHealth', 'StatisticsMeta']) await query.dropTable(table);
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0012-statistics'");
            assert.deepEqual(await migrate(sequelize), ['0012-statistics']);
            for (const table of ['ViewingDays', 'ViewingSessions', 'PlaybackHealth', 'StatisticsMeta']) assert.equal(await query.tableExists(table), true);
            assert.ok((await columns(sequelize, 'ViewingDays')).includes('watchSeconds'));
            assert.ok((await columns(sequelize, 'ViewingSessions')).includes('title'));
            assert.deepEqual(await migrate(sequelize), []);
        } finally { await sequelize.close(); }
    });

    it('creates a new database and records every migration', async () => {
        const sequelize = await database();

        assert.deepEqual(await migrate(sequelize), MIGRATIONS.map(migration => migration.name));
        assert.ok((await columns(sequelize, 'Users')).includes('groupId'));
        assert.ok((await columns(sequelize, 'Movies')).includes('siteRating'));
        assert.ok((await columns(sequelize, 'Episodes')).includes('runtime'));
        for (const table of ['People', 'MovieCredits', 'SeriesCredits', 'EpisodeCredits']) assert.ok(await sequelize.getQueryInterface().tableExists(table), table);
        assert.deepEqual(await pendingMigrations(sequelize), []);
        await sequelize.close();
    });

    it('adds unknown rating provenance without rewriting existing scores', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const movie = await Movie.create({ movieName: 'Existing', siteRating: 8, siteRatingCount: 42 });
            const query = sequelize.getQueryInterface();
            for (const table of ['Movies', 'Series', 'Episodes']) await query.removeColumn(table, 'siteRatingSource');
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0007-rating-source'");
            assert.deepEqual(await migrate(sequelize), ['0007-rating-source']);
            await movie.reload();
            assert.equal(movie.siteRating, 8);
            assert.equal(movie.siteRatingCount, 42);
            assert.equal(movie.siteRatingSource, null);
            for (const table of ['Movies', 'Series', 'Episodes']) assert.ok((await columns(sequelize, table)).includes('siteRatingSource'));
        } finally { await sequelize.close(); }
    });

    it('adds favourites and display preferences to a database from before them, one row per user and item', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const query = sequelize.getQueryInterface();
            await query.dropTable('UserFavourites');
            await query.dropTable('JellyfinDisplayPreferences');
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0008-jellyfin-user-data'");
            assert.deepEqual(await migrate(sequelize), ['0008-jellyfin-user-data']);

            const user = await User.create({ username: 'fan' });
            await UserFavourite.create({ userId: user.id, itemType: 'movie', itemId: 1 });
            await assert.rejects(UserFavourite.create({ userId: user.id, itemType: 'movie', itemId: 1 }));
            await JellyfinDisplayPreferences.create({ userId: user.id, preferencesId: 'usersettings', client: 'emby', data: '{}' });
            await assert.rejects(JellyfinDisplayPreferences.create({ userId: user.id, preferencesId: 'usersettings', client: 'emby', data: '{}' }));
        } finally { await sequelize.close(); }
    });

    it('adds chapters, segments and thumbnails to files, unanalysed, and stores them as JSON', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const file = await File.create({ path: '/media/a.mkv' });
            const query = sequelize.getQueryInterface();
            for (const column of ['chapters', 'segments', 'trickplay']) await query.removeColumn('Files', column);
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0010-playback-markers'");
            assert.deepEqual(await migrate(sequelize), ['0010-playback-markers']);

            await file.reload();
            assert.equal(file.path, '/media/a.mkv');
            assert.equal(file.chapters, null);
            assert.equal(file.segments, null);
            assert.equal(file.trickplay, null);

            await file.update({ chapters: [{ start: 0, end: 90, title: 'Intro' }], segments: [] });
            await file.reload();
            assert.deepEqual(file.chapters, [{ start: 0, end: 90, title: 'Intro' }]);
            assert.deepEqual(file.segments, []);
            assert.deepEqual(file.toJSON().chapters, [{ start: 0, end: 90, title: 'Intro' }]);
        } finally { await sequelize.close(); }
    });

    it('gives a new database unique favourites too', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const user = await User.create({ username: 'fan' });
            await UserFavourite.create({ userId: user.id, itemType: 'series', itemId: 2 });
            await assert.rejects(UserFavourite.create({ userId: user.id, itemType: 'series', itemId: 2 }));
        } finally { await sequelize.close(); }
    });

    it('does nothing the second time', async () => {
        const sequelize = await database();

        await migrate(sequelize);
        assert.deepEqual(await migrate(sequelize), []);
        await sequelize.close();
    });

    it('upgrades a database from before groups, preferences, profiles and problem files, keeping its rows', async () => {
        const sequelize = await database();
        const queryInterface = sequelize.getQueryInterface();

        // The 0.3 schema: no Groups table, and Users and Files without the later columns.
        await queryInterface.createTable('Users', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            username: DataTypes.STRING(16),
            name: DataTypes.STRING,
            email: DataTypes.STRING,
            password: DataTypes.STRING,
            access_token: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE
        });
        await queryInterface.createTable('Files', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            path: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE
        });
        await queryInterface.bulkInsert('Users', [{ username: 'robin', name: 'Robin', createdAt: new Date(), updatedAt: new Date() }]);

        await migrate(sequelize);

        const userColumnNames = await columns(sequelize, 'Users');

        for (const column of ['groupId', 'preferences', 'publicProfile', 'passwordlessLocal', 'avatar']) assert.ok(userColumnNames.includes(column), column);
        for (const column of ['problematic', 'error', 'problemStage', 'problemIgnored']) assert.ok((await columns(sequelize, 'Files')).includes(column), column);
        assert.ok(await queryInterface.tableExists('Groups'));

        const robin = await User.findOne({ where: { username: 'robin' } });

        assert.equal(robin?.name, 'Robin');
        assert.equal(robin?.publicProfile, false);
        await sequelize.close();
    });

    it('adds series-set sharing on upgrade and preserves existing sets and shares when rerun', async () => {
        const sequelize = await database();
        try {
            await migrate(sequelize);
            const query = sequelize.getQueryInterface();
            const user = await User.create({ username: 'viewer' });
            const set = await SeriesSet.create({ setName: 'Private shows', public: false });
            await query.dropTable('SeriesSetUsers');
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0011-series-set-sharing'");
            assert.deepEqual(await migrate(sequelize), ['0011-series-set-sharing']);
            assert.equal((await set.reload()).setName, 'Private shows');
            const share = { SeriesSetId: set.id, UserId: user.id, createdAt: new Date(), updatedAt: new Date() };
            await query.bulkInsert('SeriesSetUsers', [share]);
            await assert.rejects(query.bulkInsert('SeriesSetUsers', [share]), /UNIQUE/i);
            await sequelize.query("DELETE FROM SchemaMigrations WHERE name = '0011-series-set-sharing'");
            assert.deepEqual(await migrate(sequelize), ['0011-series-set-sharing']);
            const [rows] = await sequelize.query('SELECT SeriesSetId, UserId FROM SeriesSetUsers');
            assert.deepEqual(rows, [{ SeriesSetId: set.id, UserId: user.id }]);
            assert.deepEqual(await migrate(sequelize), []);
        } finally { await sequelize.close(); }
    });

    it('lists what an out-of-date database still needs', async () => {
        const sequelize = await database();

        assert.deepEqual(await pendingMigrations(sequelize), MIGRATIONS.map(migration => migration.name));
        await sequelize.close();
    });
});
