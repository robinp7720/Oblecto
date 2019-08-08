import Sequelize from 'sequelize';
import config from '../config.js';

let options = {
    dialect: config.database.dialect || 'sqlite',

    logging: false,
    operatorsAliases: false,

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

// Import models for sequelize
const tvshow = sequelize.import('tvshow', require(__dirname + '/../models/tvshow'));
const episode = sequelize.import('episodes', require(__dirname + '/../models/episode.js'));
const movie = sequelize.import('movies', require(__dirname + '/../models/movie.js'));

const user = sequelize.import('users', require(__dirname + '/../models/user.js'));

const trackEpisodes = sequelize.import('trackEpisodes', require(__dirname + '/../models/trackEpisodes.js'));
const trackMovies = sequelize.import('trackMovies', require(__dirname + '/../models/trackMovies.js'));

const file = sequelize.import('file', require(__dirname + '/../models/file.js'));

const episodeFiles = sequelize.import('episodeFiles', require(__dirname + '/../models/episodeFiles.js'));
const movieFiles = sequelize.import('movieFiles', require(__dirname + '/../models/movieFiles.js'));

const movieSet = sequelize.import('movieSet', require(__dirname + '/../models/movieSet.js'));
const tvshowSet = sequelize.import('tvshowSet', require(__dirname + '/../models/tvshowSet.js'));


episode.belongsTo(tvshow);
tvshow.hasMany(episode);

movieSet.belongsToMany(movie, {through: 'movieSetAllocations'});
movie.belongsToMany(movieSet, {through: 'movieSetAllocations'});

tvshowSet.belongsToMany(tvshow, {through: 'tvshowSetAllocations'});
tvshow.belongsToMany(tvshowSet, {through: 'tvshowSetAllocations'});

episode.belongsToMany(file, {through: episodeFiles});
movie.belongsToMany(file, {through: movieFiles});

file.belongsToMany(episode, {through: episodeFiles});
file.belongsToMany(movie, {through: movieFiles});

trackEpisodes.belongsTo(user);
trackEpisodes.belongsTo(episode);

trackMovies.belongsTo(user);
trackMovies.belongsTo(movie);

episode.hasMany(trackEpisodes);
movie.hasMany(trackMovies);

let databases = {
    tvshow,
    episode,
    movie,
    episodeFiles,
    movieFiles,
    user,
    trackEpisodes,
    trackMovies,
    file,
    movieSet,
    sequelize
};

export default databases;
