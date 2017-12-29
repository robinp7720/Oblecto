const TVDB = require('node-tvdb');
const config = require('../config.json');
const tvdb = new TVDB(config.tvdb.key);

module.exports = tvdb;

