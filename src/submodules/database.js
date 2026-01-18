import { Sequelize } from 'sequelize';
import config from '../config';
import logger from './logger';

import { Episode, episodeColumns } from '../models/episode';
import { EpisodeFiles, episodeFilesColumns } from '../models/episodeFiles';
import { File, fileColumns } from '../models/file';
import { Movie, movieColumns } from '../models/movie';
import { Series, seriesColumns } from '../models/series';
import { MovieFiles, movieFileColumns } from '../models/movieFiles';
import { MovieSet, movieSetColumns } from '../models/movieSet';
import { SeriesSet, seriesSetColumns } from '../models/seriesSet';
import { TrackMovie, trackMovieColumns } from '../models/trackMovie';
import { TrackEpisode, trackEpisodesColumns } from '../models/trackEpisode';
import { User, userColumns } from '../models/user';
import { Stream, streamColumns } from '../models/stream';

const DEFAULT_SQLITE_STORAGE = '/etc/oblecto/database.sqlite';

/** @type {Sequelize | null} */
let sequelizeInstance = null;

/**
 * @param {Sequelize} sequelize
 */
function initModels(sequelize) {
    const modelOptions = (modelName) => ({ sequelize, modelName });

    Episode.init(episodeColumns, modelOptions('Episode'));
    Movie.init(movieColumns, modelOptions('Movie'));
    Series.init(seriesColumns, modelOptions('Series'));

    File.init(fileColumns, modelOptions('File'));
    Stream.init(streamColumns, modelOptions('Stream'));

    EpisodeFiles.init(episodeFilesColumns, modelOptions('EpisodeFiles'));
    MovieFiles.init(movieFileColumns, modelOptions('MovieFiles'));

    MovieSet.init(movieSetColumns, modelOptions('MovieSet'));
    SeriesSet.init(seriesSetColumns, modelOptions('SeriesSet'));

    TrackMovie.init(trackMovieColumns, modelOptions('TrackMovie'));
    TrackEpisode.init(trackEpisodesColumns, modelOptions('TrackEpisode'));

    User.init(userColumns, modelOptions('User'));
}

/**
 * Initialize database model associations and relationships.
 *
 * This function sets up the relationships between different models
 */
function initAssociations() {
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

    TrackEpisode.belongsTo(User);
    TrackEpisode.belongsTo(Episode);

    TrackMovie.belongsTo(User);
    TrackMovie.belongsTo(Movie);

    Episode.hasMany(TrackEpisode);
    Movie.hasMany(TrackMovie);
}

/**
 *
 * @returns {Sequelize} - Connection to database
 */
export function initDatabase() {
    if (sequelizeInstance) {
        return sequelizeInstance;
    }

    const dialect = config.database.dialect || 'sqlite';
    const poolMax = dialect === 'sqlite' ? 1 : config.queue.concurrency;

    if (dialect === 'sqlite') {
        logger.info('Using SQLITE, setting pool max to 1');
    }

    /** @type {import('sequelize').Options} */
    const options = {
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
        options.storage = config.database.storage || DEFAULT_SQLITE_STORAGE;
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
