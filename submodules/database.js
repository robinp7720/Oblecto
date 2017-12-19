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
const user = sequelize.import(__dirname + "/../models/user.js");
const track = sequelize.import(__dirname + "/../models/track.js");

episode.belongsTo(tvshow);

track.belongsTo(user);
track.belongsTo(tvshow);

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
        tvshow.sync().then(() => callback());
    },
    (callback) => {
        episode.sync().then(() => callback());
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
    user,
    track
};