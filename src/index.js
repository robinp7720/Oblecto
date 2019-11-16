import config from './config';

import restapi from './submodules/REST';

import UserManager from './submodules/users';
import SeriesCollector from './lib/indexers/series/SeriesCollector';
import MovieCollector from './lib/indexers/movies/MovieCollector';

import FileCleaner from './lib/indexers/files/cleaner';
import TVShowCleaner from './lib/indexers/series/SeriesCleaner';
import MovieCleaner from './lib/indexers/movies/MovieCleaner';

import socketio from 'socket.io';

// Load Oblecto submodules
if (config.mdns.enable) {
    (async () => {
       let zeroconf = (await import('./submodules/zeroconf.js')).default;
        zeroconf.start(config.server.port);
    });
}

// Start the rest api
let server = restapi();

if (config.indexer.runAtBoot) {
    // Index TV Shows
    SeriesCollector.CollectAll();

    // Index movies
    MovieCollector.CollectAll();
}

if (config.cleaner.runAtBoot) {
    // Clean up old library entries
    FileCleaner.removedDeletedFiled();
    FileCleaner.removeAssoclessFiles();
    TVShowCleaner.removePathLessShows();
    MovieCleaner.removeFileLessMovies();
}

// Socket connection
let io = socketio.listen(server.server, {
    log: false,
    agent: false,
    origins: '*:*',
    transports: ['websocket', 'polling']
});

io.on('connection', socket => UserManager.userConnected(socket));

// Periodically save the user storage to the database
setInterval(() => {
    UserManager.saveAllUserProgress();
}, 1000 * config.tracker.interval);
