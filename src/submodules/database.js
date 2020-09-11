import Sequelize from 'sequelize';
import config from '../config.js';

import {Episode, episodeColumns} from '../models/episode';
import {EpisodeFiles, episodeFilesColumns} from '../models/episodeFiles';
import {File, fileColumns} from '../models/file';
import {Movie, movieColumns} from '../models/movie';
import {Series, seriesColumns} from '../models/series';
import {MovieFiles, movieFileColumns} from '../models/movieFiles';
import {MovieSet, movieSetColumns} from '../models/movieSet';
import {SeriesSet, seriesSetColumns} from '../models/seriesSet';
import {TrackMovie, trackMovieColumns} from '../models/trackMovie';
import {TrackEpisode, trackEpisodesColumns} from '../models/trackEpisode';
import {User, userColumns} from '../models/user';

export function initDatabes() {
    let options = {
        dialect: config.database.dialect || 'sqlite',

        logging: false,
        //operatorsAliases: false,

        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    };

    if (options.dialect !== 'sqlite') {
        options.host = config.database.host || 'localhost';
    }

    if (options.dialect === 'sqlite') {
        options.storage = config.database.storage || '/etc/oblecto/database.sqlite';
    }

    const sequelize = new Sequelize(config.database.database, config.database.username, config.database.password, options);

    Episode.init(episodeColumns, {sequelize});
    Movie.init(movieColumns, {sequelize});
    Series.init(seriesColumns, {sequelize});

    File.init(fileColumns, {sequelize});

    EpisodeFiles.init(episodeFilesColumns, {sequelize});
    MovieFiles.init(movieFileColumns, {sequelize});

    MovieSet.init(movieSetColumns, {sequelize});
    SeriesSet.init(seriesSetColumns, {sequelize});

    TrackMovie.init(trackMovieColumns, {sequelize});
    TrackEpisode.init(trackEpisodesColumns, {sequelize});

    User.init(userColumns, {sequelize});

    Episode.belongsTo(Series);
    Series.hasMany(Episode);

    MovieSet.belongsToMany(Movie, {through: 'movieSetAllocations'});
    MovieSet.belongsToMany(User, {through: 'movieSetUsers'});
    Movie.belongsToMany(MovieSet, {through: 'movieSetAllocations'});

    SeriesSet.belongsToMany(Series, {through: 'tvshowSetAllocations'});
    Series.belongsToMany(SeriesSet, {through: 'tvshowSetAllocations'});

    Episode.belongsToMany(File, {through: EpisodeFiles});
    Movie.belongsToMany(File, {through: MovieFiles});

    File.belongsToMany(Episode, {through: EpisodeFiles});
    File.belongsToMany(Movie, {through: MovieFiles});

    TrackEpisode.belongsTo(User);
    TrackEpisode.belongsTo(Episode);

    TrackMovie.belongsTo(User);
    TrackMovie.belongsTo(Movie);

    Episode.hasMany(TrackEpisode);
    Movie.hasMany(TrackMovie);

    return sequelize;
}
