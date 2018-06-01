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
const trackEpisodes = sequelize.import(__dirname + "/../models/trackEpisodes.js");
const file = sequelize.import(__dirname + "/../models/file.js");

const episodeFiles = sequelize.import(__dirname + "/../models/episodeFiles.js");
const movieFiles = sequelize.import(__dirname + "/../models/movieFiles.js");


episode.belongsTo(tvshow);

episode.belongsToMany(file, {through: episodeFiles});
movie.belongsToMany(file, {through: movieFiles});

trackEpisodes.belongsTo(user);
trackEpisodes.belongsTo(episode);

episode.hasMany(trackEpisodes);

let databases = {
    tvshow,
    episode,
    movie,
    episodeFiles,
    movieFiles,
    user,
    trackEpisodes,
    file
};

sequelize
    .authenticate()
    .then(() => {
        // Create databases if connection to the database could be established
        for (let prop in databases) {
            databases[prop].sync();
        }
    })
    .catch((err) => {
        console.log(err);
    });


module.exports = databases;