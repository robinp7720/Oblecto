import async from 'async';
import fs from 'fs';
import request from 'request';

import TvScanner from '../lib/indexers/tv/scanner';
import MovieScanner from '../lib/indexers/movies/scanner';

import TVShowArt from '../lib/indexers/tv/art';
import MovieArt from '../lib/indexers/movies/art';
import transcoder from '../transcoders';

import config from '../config.json';


export default async.queue((task, callback) => {
    switch (task.task) {
    case 'episode':
        TvScanner(task.path, config.tvshows.doReIndex).then(callback).catch(callback);
        break;
    case 'movie':
        MovieScanner(task.path).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadEpisodeBanner':
        TVShowArt.DownloadEpisodeBanner(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadSeriesPoster':
        TVShowArt.DownloadSeriesPoster(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadMoviePoster':
        MovieArt.DownloadMoviePoster(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadMovieFanart':
        MovieArt.DownloadMovieFanart(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'transcode':
        transcoder.transcode(task.path, callback);
        break;
    case 'download':
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

}, config.queue.concurrency);