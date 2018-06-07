import config from '../config.json';
import moviedb from 'moviedb-promise';

const moviedbInstance = new moviedb(config.themoviedb.key);

export default moviedbInstance;

