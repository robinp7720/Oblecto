import TVDB from 'node-tvdb';
import config from '../config.js';

let tvdb = new TVDB(config.tvdb.key);

export default tvdb;
