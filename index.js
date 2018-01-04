import restapi from "./submodules/api";

const config = require('./config.json');

const socketio = require("socket.io");

const TVShowIndexer = require('./lib/indexers/tv');
const MovieIndexer = require('./lib/indexers/movies');


// Load Oblecto submodules
const zeroconf = require('./submodules/zeroconf');
zeroconf.start(config.server.port);
const UserManager = require('./submodules/users');

// Start the rest api
let server = restapi();


if (config.indexer.runAtBoot) {
    // Index TV Shows
    TVShowIndexer.indexAll(() => {});

    // Index movies
    MovieIndexer.indexAll(() => {});
}

// Socket connection
let io = socketio.listen(server.server, {
    log: false,
    agent: false,
    origins: '*:*',
    transports: ['websocket', 'polling']
});

io.on('connection', UserManager.userConnected);

// Periodically save the user storage to the database
setInterval(() => {
    UserManager.saveAllUserProgress(() => {
        console.log('User progress save');
    })
}, 1000 * config.tracker.interval);


