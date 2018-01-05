const config = require('../config.json');
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
const tvshow = sequelize.import(__dirname + "/../models/tvshow.js");
const episode = sequelize.import(__dirname + "/../models/episode.js");
const movie = sequelize.import(__dirname + "/../models/movie.js");
const user = sequelize.import(__dirname + "/../models/user.js");
const track = sequelize.import(__dirname + "/../models/track.js");
const file = sequelize.import(__dirname + "/../models/file.js");

const episodeFiles = sequelize.import(__dirname + "/../models/episodeFiles.js");
const movieFiles = sequelize.import(__dirname + "/../models/movieFiles.js");


episode.belongsTo(tvshow);

episode.belongsToMany(file, {through: episodeFiles});
movie.belongsToMany(file, {through: movieFiles});

track.belongsTo(user);
track.belongsTo(episode);

async.series([
    (callback) => {
        sequelize
            .authenticate()
            .then(callback)
            .catch((err) => {
                console.log(err);
            });
    },
    (callback) => {
        file.sync().then(() => callback());
    },
    (callback) => {
        tvshow.sync().then(() => callback());
    },
    (callback) => {
        episode.sync().then(() => callback());
    },
    (callback) => {
        movie.sync().then(() => callback());
    },
    (callback) => {
        episodeFiles.sync().then(() => callback());
    },
    (callback) => {
        movieFiles.sync().then(() => callback());
    },
    (callback) => {
        user.sync().then(() => callback());
    },
    (callback) => {
        track.sync().then(() => callback());
    }
], (err) => {

});

module.exports = {
    tvshow,
    episode,
    movie,
    user,
    track,
    file
};