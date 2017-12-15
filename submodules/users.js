const jwt = require('jsonwebtoken');
const config = require('../config.json');

var users = {
    users: {},

    userConnected: (socket) => {
        socket.on('authenticate', (data) => users.userAuthenticate(socket, data));
        socket.on('playing', (data) => users.trackProgress(socket, data));
    },

    userAuthenticate: (socket, data) => {
        jwt.verify(data.token, config.authentication.secret, function (err, decoded) {
            if (err)
                return false;

            // Add user first into memory if the user isn't there
            users.userAdd(decoded);

            users.users[decoded.username].socket = socket;

            socket.authentication = decoded;
        });
    },

    userAdd: (authentication) => {
        if (users.users[authentication.username])
            return false;

        users.users[authentication.username] = {
            storage: {}
        };

        // Load the progress of the newly added user
        users.loadProgress(authentication.username);
    },

    loadProgress: (username) => {

    },


    // Save progress of a user to memory
    trackProgress: (socket, data) => {
        if (!socket.authentication)
            return false;
        if (data.time && data.time > 0)
            users.users[socket.authentication.username]['storage'][data.tvshow] = data;
    },

    // Method to check if a certain user has save progress in a show
    hasSavedProgress: (username, tvdbid) => {
        return users.users[username]['storage'][tvdbid] !== undefined
    },

    getSavedProgress: (username, tvdbid) => {
        return users.users[username]['storage'][tvdbid]
    }
};

module.exports = users;