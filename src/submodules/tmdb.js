import config from "../config.json";
import moviedb from "moviedb-promise";
export default moviedb(config.themoviedb.key);

