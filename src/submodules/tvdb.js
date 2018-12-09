import TVDB from 'node-tvdb';
import config from '../config.js';

let tvdb = new TVDB(config.tvdb.key);

// Auto reconnect to tvdb if connection has died
setInterval(function () {
    tvdb.getSeriesById(70851)
        .catch(function () {
            tvdb = new TVDB(config.tvdb.key);
        });
}, 1000 * 60 * 60);

export default tvdb;