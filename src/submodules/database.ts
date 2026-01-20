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
 * @param sequelize - Sequelize instance
 */
function initModels(sequelize: Sequelize): void {
    const modelOptions = (modelName: string): { sequelize: Sequelize; modelName: string } => ({ sequelize, modelName });

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
        options.storage = config.database.storage ?? DEFAULT_SQLITE_STORAGE;
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
