import TVDB from "node-tvdb";
import config from "../config.json";
export default new TVDB(config.tvdb.key);

