import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { DataTypes, Sequelize } from 'sequelize';
import { MIGRATIONS, migrate, pendingMigrations } from '../../src/submodules/migrations/index.js';
import { User, userColumns } from '../../src/models/user.js';
import { Group, groupColumns } from '../../src/models/group.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Person, personColumns } from '../../src/models/person.js';
import { MovieCredit, movieCreditColumns } from '../../src/models/movieCredit.js';
import { SeriesCredit, seriesCreditColumns } from '../../src/models/seriesCredit.js';
import { EpisodeCredit, episodeCreditColumns } from '../../src/models/episodeCredit.js';

// A throwaway database with the models the migrations touch registered on it.
async function database(): Promise<Sequelize> {
    const sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

    User.init(userColumns, { sequelize, modelName: 'User' });
    Group.init(groupColumns, { sequelize, modelName: 'Group' });
    File.init(fileColumns, { sequelize, modelName: 'File' });
    Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
    Series.init(seriesColumns, { sequelize, modelName: 'Series' });
    Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
    Person.init(personColumns, { sequelize, modelName: 'Person' });
    MovieCredit.init(movieCreditColumns, { sequelize, modelName: 'MovieCredit' });
    SeriesCredit.init(seriesCreditColumns, { sequelize, modelName: 'SeriesCredit' });
    EpisodeCredit.init(episodeCreditColumns, { sequelize, modelName: 'EpisodeCredit' });

    return sequelize;
}

const columns = async (sequelize: Sequelize, table: string): Promise<string[]> => Object.keys(await sequelize.getQueryInterface().describeTable(table));

describe('Database migrations', () => {
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

    it('lists what an out-of-date database still needs', async () => {
        const sequelize = await database();

        assert.deepEqual(await pendingMigrations(sequelize), MIGRATIONS.map(migration => migration.name));
        await sequelize.close();
    });
});
