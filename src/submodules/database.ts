import { Sequelize, Dialect, Options } from 'sequelize';
import config from '../config.js';
import logger from './logger/index.js';

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
import { Stream, streamColumns } from '../models/stream.js';

const DEFAULT_SQLITE_STORAGE = '/etc/oblecto/database.sqlite';

let sequelizeInstance: Sequelize | null = null;

/**
 * @param sequelize
 */
function initModels(sequelize: Sequelize) {
    const modelOptions = (modelName: string) => ({ sequelize, modelName });

    Episode.init(episodeColumns as any, modelOptions('Episode'));
    Movie.init(movieColumns as any, modelOptions('Movie'));
    Series.init(seriesColumns as any, modelOptions('Series'));

    File.init(fileColumns as any, modelOptions('File'));
    Stream.init(streamColumns as any, modelOptions('Stream'));

    EpisodeFiles.init(episodeFilesColumns as any, modelOptions('EpisodeFiles'));
    MovieFiles.init(movieFileColumns as any, modelOptions('MovieFiles'));

    MovieSet.init(movieSetColumns as any, modelOptions('MovieSet'));
    SeriesSet.init(seriesSetColumns as any, modelOptions('SeriesSet'));

    TrackMovie.init(trackMovieColumns as any, modelOptions('TrackMovie'));
    TrackEpisode.init(trackEpisodesColumns as any, modelOptions('TrackEpisode'));

    User.init(userColumns as any, modelOptions('User'));
}

/**
 * Initialize database model associations and relationships.
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
 * @returns - Connection to database
 */
export function initDatabase(): Sequelize {
    if (sequelizeInstance) {
        return sequelizeInstance;
    }

    const dialect = (config.database.dialect as Dialect) || 'sqlite';
    const poolMax = dialect === 'sqlite' ? 1 : config.queue.concurrency;

    if (dialect === 'sqlite') {
        logger.info('Using SQLITE, setting pool max to 1');
    }

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
