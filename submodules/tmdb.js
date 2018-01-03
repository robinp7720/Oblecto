const config = require('../config.json');

module.exports = require('moviedb')(config.themoviedb.key);

