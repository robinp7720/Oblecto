import async from "async";
import fs from "fs";
import request from "request"

import TvScanner from "../lib/indexers/tv/scanner";
import MovieScanner from "../lib/indexers/movies/scanner";


export default async.queue((task, callback) => {
    switch (task.task) {
        case "episode":
            TvScanner(task.path).then(callback).catch(callback);
            break;
        case "movie":
            MovieScanner(task.path).then(callback).catch(err => {
                console.log(err);
                callback();
            });
            break;
        case "download":
            request.get({
                uri: task.url,
                encoding: null
            }, function (err, response, body) {
                fs.writeFile(task.path, body, callback);
            });
            break;
        default:
            callback();
            break;
    }

}, 1);