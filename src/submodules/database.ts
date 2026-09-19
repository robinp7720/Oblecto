import { Sequelize, Dialect, Options } from 'sequelize';
import config from '../config.js';
import logger from './logger/index.js';
import { chooseSqliteDriver } from './sqliteDriver.js';

import { Episode, episodeColumns } from '../models/episode.js';
import { EpisodeFiles, episodeFilesColumns } from '../models/episodeFiles.js';
import { File, fileColumns } from '../models/file.js';
import { Movie, movieColumns } from '../models/movie.js';
import { Series, seriesColumns } from '../models/series.js';
import { MovieFiles, movieFileColumns } from '../models/movieFiles.js';
import { MovieSet, movieSetColumns } from '../models/movieSet.js';
import { SeriesSet, seriesSetColumns } from '../models/seriesSet.js';
import { TrackMovie, trackMovieColumns } from '../models/trackMovie.js';
import { TrackEpisode, trackEpisodesColumns } from '../models/trackEpisode.js';
import { User, userColumns } from '../models/user.js';
import { Group, groupColumns } from '../models/group.js';
import { Stream, streamColumns } from '../models/stream.js';
import { Person, personColumns } from '../models/person.js';
import { MovieCredit, movieCreditColumns } from '../models/movieCredit.js';
import { SeriesCredit, seriesCreditColumns } from '../models/seriesCredit.js';
import { EpisodeCredit, episodeCreditColumns } from '../models/episodeCredit.js';

const DEFAULT_SQLITE_STORAGE = '/etc/oblecto/database.sqlite';

let sequelizeInstance: Sequelize | null = null;

/**
 * @param sequelize - Sequelize instance
 */
function initModels(sequelize: Sequelize): void {
    const modelOptions = (modelName: string): { sequelize: Sequelize; modelName: string } => ({ sequelize, modelName });

    Episode.init(episodeColumns, modelOptions('Episode'));
    Movie.init(movieColumns, modelOptions('Movie'));
    Series.init(seriesColumns, modelOptions('Series'));
    Person.init(personColumns, modelOptions('Person'));
    MovieCredit.init(movieCreditColumns, modelOptions('MovieCredit'));
    SeriesCredit.init(seriesCreditColumns, modelOptions('SeriesCredit'));
    EpisodeCredit.init(episodeCreditColumns, modelOptions('EpisodeCredit'));

    File.init(fileColumns, modelOptions('File'));
    Stream.init(streamColumns, modelOptions('Stream'));

    EpisodeFiles.init(episodeFilesColumns, modelOptions('EpisodeFiles'));
    MovieFiles.init(movieFileColumns, modelOptions('MovieFiles'));

    MovieSet.init(movieSetColumns, modelOptions('MovieSet'));
    SeriesSet.init(seriesSetColumns, modelOptions('SeriesSet'));

    TrackMovie.init(trackMovieColumns, modelOptions('TrackMovie'));
    TrackEpisode.init(trackEpisodesColumns, modelOptions('TrackEpisode'));

    User.init(userColumns, modelOptions('User'));
    Group.init(groupColumns, modelOptions('Group'));
}

/**
 * Initialize database model associations and relationships.
 */
function initAssociations(): void {
    Episode.belongsTo(Series);
    Series.hasMany(Episode);

    MovieSet.belongsToMany(Movie, { through: 'MovieSetAllocations' });
    MovieSet.belongsToMany(User, { through: 'MovieSetUsers' });
    Movie.belongsToMany(MovieSet, { through: 'MovieSetAllocations' });

    SeriesSet.belongsToMany(Series, { through: 'SeriesSetAllocations' });
    Series.belongsToMany(SeriesSet, { through: 'SeriesSetAllocations' });

    Episode.belongsToMany(File, { through: EpisodeFiles });
    Movie.belongsToMany(File, { through: MovieFiles });

    File.belongsToMany(Episode, { through: EpisodeFiles });
    File.belongsToMany(Movie, { through: MovieFiles });
    Stream.belongsTo(File);
    File.hasMany(Stream);

    User.belongsTo(Group, { foreignKey: 'groupId', onDelete: 'SET NULL' });
    Group.hasMany(User, { foreignKey: 'groupId' });

    // The tracking models declare userId, episodeId and movieId. Naming them here keeps Sequelize from
    // adding a second, capitalised key that databases treat as the same column.
    TrackEpisode.belongsTo(User, { foreignKey: 'userId' });
    TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });

    TrackMovie.belongsTo(User, { foreignKey: 'userId' });
    TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });

    Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
    Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });

    Movie.hasMany(MovieCredit, {
        foreignKey: 'movieId',
        as: 'Credits',
        onDelete: 'CASCADE'
    });
    MovieCredit.belongsTo(Movie, { foreignKey: 'movieId' });
    Series.hasMany(SeriesCredit, {
        foreignKey: 'seriesId',
        as: 'Credits',
        onDelete: 'CASCADE'
    });
    SeriesCredit.belongsTo(Series, { foreignKey: 'seriesId' });
    Episode.hasMany(EpisodeCredit, {
        foreignKey: 'episodeId',
        as: 'Credits',
        onDelete: 'CASCADE'
    });
    EpisodeCredit.belongsTo(Episode, { foreignKey: 'episodeId' });

    Person.hasMany(MovieCredit, {
        foreignKey: 'personId',
        as: 'MovieCredits',
        onDelete: 'CASCADE'
    });
    MovieCredit.belongsTo(Person, { foreignKey: 'personId' });
    Person.hasMany(SeriesCredit, {
        foreignKey: 'personId',
        as: 'SeriesCredits',
        onDelete: 'CASCADE'
    });
    SeriesCredit.belongsTo(Person, { foreignKey: 'personId' });
    Person.hasMany(EpisodeCredit, {
        foreignKey: 'personId',
        as: 'EpisodeCredits',
        onDelete: 'CASCADE'
    });
    EpisodeCredit.belongsTo(Person, { foreignKey: 'personId' });
}

/**
 * @returns - Connection to database
 */
export function initDatabase(): Sequelize {
    if (sequelizeInstance) {
        return sequelizeInstance;
    }

    const dialect = (config.database.dialect as Dialect) || 'sqlite';
    const poolMax = dialect === 'sqlite' ? 1 : config.queue.concurrency;

    const options: Options = {
        dialect,
        logging: false,
        pool: {
            max: poolMax,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        retry: { max: 5 }
    };

    if (dialect !== 'sqlite') {
        options.host = config.database.host || 'localhost';
    } else {
        options.storage = config.database.storage ?? DEFAULT_SQLITE_STORAGE;

        const driver = chooseSqliteDriver();

        options.dialectModule = driver.module;
        if (driver.fallbackReason) {
            logger.info(`Using SQLite through Node's built-in node:sqlite: ${driver.fallbackReason}. For the native module, reinstall with --allow-scripts=sqlite3`);
        } else {
            logger.info('Using SQLite through the native sqlite3 module');
        }
    }

    sequelizeInstance = new Sequelize({
        database: config.database.database,
        username: config.database.username,
        password: config.database.password,
        ...options
    });

    initModels(sequelizeInstance);
    initAssociations();

    return sequelizeInstance;
}
