import restapi from "./submodules/api";
import UserManager from "./submodules/users";

const config = require('./config.json');

const socketio = require("socket.io");

const TVShowIndexer = require('./lib/indexers/tv');
const MovieIndexer = require('./lib/indexers/movies');


// Load Oblecto submodules
const zeroconf = require('./submodules/zeroconf');
zeroconf.start(config.server.port);
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

io.on('connection', socket => UserManager.userConnected(socket));

// Periodically save the user storage to the database
setInterval(() => {
    UserManager.saveAllUserProgress()
}, 1000 * config.tracker.interval);


