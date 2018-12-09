import config from '../config.js';
import moviedb from 'moviedb-promise';

const moviedbInstance = new moviedb(config.themoviedb.key);

export default moviedbInstance;

