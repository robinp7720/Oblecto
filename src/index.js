import restapi from './submodules/REST';

import UserManager from './submodules/users';
import TVShowIndexer from './lib/indexers/tv';
import MovieIndexer from './lib/indexers/movies';

import FileCleaner from './lib/indexers/files/cleaner';
import TVShowCleaner from './lib/indexers/tv/cleaner';
import MovieCleaner from './lib/indexers/movies/cleaner';

import config from './config';

import socketio from 'socket.io'
import mkdirp from 'mkdirp';

// Create directories for image assets
for (let i in config.assets) {
    let path = config.assets[i];
    if (typeof path !== "string") {
        continue
    }

    mkdirp(config.assets[i])
}

// Load Oblecto submodules
if (config.mdns.enable) {
    zeroconf.start(config.server.port);
}

// Start the rest api
let server = restapi();

if (config.indexer.runAtBoot) {
    // Index TV Shows
    TVShowIndexer.indexAll();

    // Index movies
    MovieIndexer.indexAll();
}

// Clean up old library entries
FileCleaner.removedDeletedFiled();
TVShowCleaner.removePathLessShows();
MovieCleaner.removeFileLessMovies();

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
