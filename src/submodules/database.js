import config from '../config.js';
const Sequelize = require('sequelize');
const async = require('async');


const sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, {
    host: config.mysql.host,
    dialect: 'mysql',
    logging: false,

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
});

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


episode.belongsTo(tvshow);
tvshow.hasMany(episode);

episode.belongsToMany(file, {through: episodeFiles});
movie.belongsToMany(file, {through: movieFiles});

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
    file
};

sequelize
    .authenticate()
    .then(() => {
        // Create databases if connection to the database could be establishe
        sequelize.sync();
    })
    .catch((err) => {
        console.log(err);
    });


module.exports = databases;