import config from "../config.json";
import moviedb from "moviedb";
export default moviedb(config.themoviedb.key);

