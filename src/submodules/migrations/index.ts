import { DataTypes, type DataType, type ModelAttributeColumnOptions, type QueryInterface, type Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import logger from '../logger/index.js';

type Context = { sequelize: Sequelize; queryInterface: QueryInterface };

type Migration = {
    name: string;
    up: (context: Context) => Promise<void>;
};

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

async function hasColumn(queryInterface: QueryInterface, table: string, column: string): Promise<boolean> {
    const description = await queryInterface.describeTable(table);

    return Object.keys(description).some(name => sameName(name, column));
}

async function hasTable(queryInterface: QueryInterface, table: string): Promise<boolean> {
    const tables = await queryInterface.showAllTables();

    return tables.some(entry => sameName(typeof entry === 'string' ? entry : String(entry), table));
}

/**
 * Add a column unless it is there already. Every migration is written this way: databases upgraded
 * by hand from docs/UPGRADING.md, or created fresh by the baseline, already have these columns.
 */
async function addColumnIfMissing(queryInterface: QueryInterface, table: string, column: string, definition: ColumnDefinition): Promise<void> {
    if (await hasColumn(queryInterface, table, column)) return;

    logger.info(`Migrating: adding ${table}.${column}`);
    await queryInterface.addColumn(table, column, definition);
}

async function addIndexIfMissing(queryInterface: QueryInterface, table: string, fields: string[], name: string): Promise<void> {
    const indexes = await queryInterface.showIndex(table) as Array<{ name: string }>;
    if (indexes.some(index => sameName(index.name, name))) return;
    await queryInterface.addIndex(table, fields, { name });
}

type ColumnDefinition = ModelAttributeColumnOptions;

const optional = (type: DataType): ColumnDefinition => ({ type, allowNull: true });

// A flag that is off unless set, as the models define them
const FLAG: ColumnDefinition = {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
};

/** In order. Never edit or reorder a released migration; add a new one. */
export const MIGRATIONS: Migration[] = [
    {
        // Creates every table that does not exist yet from the current models. On a new database
        // that is all of them, which leaves the migrations below nothing to do.
        name: '0001-baseline',
        up: async ({ sequelize }) => {
            await sequelize.sync();
        }
    },
    {
        name: '0002-user-groups',
        up: async ({ sequelize, queryInterface }) => {
            await addColumnIfMissing(queryInterface, 'Users', 'groupId', optional(DataTypes.INTEGER));

            // SQLite cannot add a foreign key to an existing table; it does not enforce them by default either.
            if (sequelize.getDialect() === 'sqlite') return;

            const references = await queryInterface.getForeignKeyReferencesForTable('Users') as { columnName?: string }[];

            if (references.some(reference => reference.columnName !== undefined && sameName(reference.columnName, 'groupId'))) return;

            await queryInterface.addConstraint('Users', {
                fields: ['groupId'],
                type: 'foreign key',
                name: 'fk_users_group',
                references: { table: 'Groups', field: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE'
            });
        }
    },
    {
        name: '0003-account-preferences',
        up: async ({ queryInterface }) => {
            await addColumnIfMissing(queryInterface, 'Users', 'preferences', optional(DataTypes.TEXT));
        }
    },
    {
        name: '0004-profile-picker',
        up: async ({ queryInterface }) => {
            await addColumnIfMissing(queryInterface, 'Users', 'publicProfile', FLAG);
            await addColumnIfMissing(queryInterface, 'Users', 'passwordlessLocal', FLAG);
            await addColumnIfMissing(queryInterface, 'Users', 'avatar', optional(DataTypes.STRING));
        }
    },
    {
        name: '0005-problem-files',
        up: async ({ queryInterface }) => {
            await addColumnIfMissing(queryInterface, 'Files', 'problematic', { ...optional(DataTypes.BOOLEAN), defaultValue: false });
            await addColumnIfMissing(queryInterface, 'Files', 'error', optional(DataTypes.TEXT));
            await addColumnIfMissing(queryInterface, 'Files', 'problemStage', optional(DataTypes.STRING));
            await addColumnIfMissing(queryInterface, 'Files', 'problemIgnored', FLAG);
        }
    },
    {
        name: '0006-rich-media-metadata',
        up: async ({ queryInterface }) => {
            if (await hasTable(queryInterface, 'Movies')) {
                await addColumnIfMissing(queryInterface, 'Movies', 'siteRating', optional(DataTypes.DOUBLE));
                await addColumnIfMissing(queryInterface, 'Movies', 'siteRatingCount', optional(DataTypes.INTEGER));
            }
            if (await hasTable(queryInterface, 'Episodes')) {
                await addColumnIfMissing(queryInterface, 'Episodes', 'runtime', optional(DataTypes.INTEGER));
                await addColumnIfMissing(queryInterface, 'Episodes', 'siteRating', optional(DataTypes.DOUBLE));
                await addColumnIfMissing(queryInterface, 'Episodes', 'siteRatingCount', optional(DataTypes.INTEGER));
            }

            if (!await hasTable(queryInterface, 'People')) {
                await queryInterface.createTable('People', {
                    id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true
                    },
                    tmdbid: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                        unique: true
                    },
                    name: { type: DataTypes.STRING, allowNull: false },
                    biography: optional(DataTypes.TEXT),
                    birthday: optional(DataTypes.DATEONLY),
                    deathday: optional(DataTypes.DATEONLY),
                    placeOfBirth: optional(DataTypes.STRING),
                    knownForDepartment: optional(DataTypes.STRING),
                    profilePath: optional(DataTypes.STRING),
                    metadataUpdatedAt: optional(DataTypes.DATE),
                    createdAt: { type: DataTypes.DATE, allowNull: false },
                    updatedAt: { type: DataTypes.DATE, allowNull: false }
                });
            }

            const createCredits = async (table: string, mediaColumn: string, mediaTable: string, includeEpisodeCount = false): Promise<void> => {
                if (!await hasTable(queryInterface, table)) {
                    const columns: Record<string, ColumnDefinition> = {
                        id: {
                            type: DataTypes.INTEGER,
                            primaryKey: true,
                            autoIncrement: true
                        },
                        [mediaColumn]: {
                            type: DataTypes.INTEGER,
                            allowNull: false,
                            references: { model: mediaTable, key: 'id' },
                            onDelete: 'CASCADE'
                        },
                        personId: {
                            type: DataTypes.INTEGER,
                            allowNull: false,
                            references: { model: 'People', key: 'id' },
                            onDelete: 'CASCADE'
                        },
                        creditType: { type: DataTypes.STRING, allowNull: false },
                        character: optional(DataTypes.STRING),
                        job: optional(DataTypes.STRING),
                        department: optional(DataTypes.STRING),
                        sortOrder: optional(DataTypes.INTEGER),
                        createdAt: { type: DataTypes.DATE, allowNull: false },
                        updatedAt: { type: DataTypes.DATE, allowNull: false }
                    };

                    if (includeEpisodeCount) columns.episodeCount = optional(DataTypes.INTEGER);
                    await queryInterface.createTable(table, columns);
                }
                await addIndexIfMissing(queryInterface, table, [mediaColumn], `${table}_${mediaColumn}`);
                await addIndexIfMissing(queryInterface, table, ['personId'], `${table}_personId`);
                await addIndexIfMissing(queryInterface, table, [mediaColumn, 'creditType'], `${table}_${mediaColumn}_creditType`);
            };

            await createCredits('MovieCredits', 'movieId', 'Movies');
            await createCredits('SeriesCredits', 'seriesId', 'Series', true);
            await createCredits('EpisodeCredits', 'episodeId', 'Episodes');
        }
    },
    {
        name: '0007-rating-source',
        up: async ({ queryInterface }) => {
            for (const table of ['Movies', 'Series', 'Episodes']) {
                await addColumnIfMissing(queryInterface, table, 'siteRatingSource', optional(DataTypes.STRING));
            }
        }
    }
];

export function createMigrator(sequelize: Sequelize, migrations: Migration[] = MIGRATIONS): Umzug<Context> {
    return new Umzug({
        migrations: migrations.map(migration => ({ name: migration.name, up: ({ context }) => migration.up(context) })),
        context: { sequelize, queryInterface: sequelize.getQueryInterface() },
        storage: new SequelizeStorage({ sequelize, tableName: 'SchemaMigrations' }),
        logger: undefined
    });
}

/** Names of migrations this database has not run yet. */
export async function pendingMigrations(sequelize: Sequelize): Promise<string[]> {
    return (await createMigrator(sequelize).pending()).map(migration => migration.name);
}

/** Bring the database up to date. Returns the names of the migrations that ran. */
export async function migrate(sequelize: Sequelize): Promise<string[]> {
    const ran = await createMigrator(sequelize).up();

    return ran.map(migration => migration.name);
}
