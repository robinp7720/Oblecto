import async from 'async';
import fs from 'fs';
import request from 'request';

import SeriesIdentifier from '../lib/indexers/series/SeriesIdentifer';
import MovieIdentifier from '../lib/indexers/movies/MovieIdentifier';

import SeriesArtworkRetriever from '../lib/indexers/series/SeriesArtworkRetriever';
import MovieArtworkRetriever from '../lib/indexers/movies/MovieArtworkRetriever';
import transcoder from '../transcoders/';

import config from '../config.js';


export default async.queue((task, callback) => {
    switch (task.task) {
    case 'episode':
        SeriesIdentifier(task.path, config.tvshows.doReIndex).then(callback).catch(callback);
        break;
    case 'movie':
        MovieIdentifier(task.path, config.movies.doReIndex).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadEpisodeBanner':
        SeriesArtworkRetriever.DownloadEpisodeBanner(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadSeriesPoster':
        SeriesArtworkRetriever.DownloadSeriesPoster(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadMoviePoster':
        MovieArtworkRetriever.DownloadMoviePoster(task.id).then(callback).catch((err) => {
            console.log(err);
            callback();
        });
        break;
    case 'DownloadMovieFanart':
        MovieArtworkRetriever.DownloadMovieFanart(task.id).then(callback).catch((err) => {
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