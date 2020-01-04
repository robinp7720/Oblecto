import async from 'async';
import fs from 'fs';
import request from 'request';

import SeriesIndexer from '../lib/indexers/series/SeriesIndexer';
import MovieIndexer from '../lib/indexers/movies/MovieIndexer';

import SeriesArtworkRetriever from '../lib/indexers/series/SeriesArtworkRetriever';
import MovieArtworkRetriever from '../lib/indexers/movies/MovieArtworkRetriever';
import transcoder from '../transcoders/';

import config from '../config.js';


export default async.queue((task, callback) => {
    switch (task.task) {
    case 'episode':
        SeriesIndexer(task.path, task.doReIndex || config.tvshows.doReIndex).then(callback).catch(callback);
        break;
    case 'movie':
        MovieIndexer(task.path, task.doReIndex || config.movies.doReIndex).then(callback).catch((err) => {
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
        SeriesArtworkRetriever.downloadSeriesPoster(task.id).then(callback).catch((err) => {
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
