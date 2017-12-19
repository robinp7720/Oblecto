const jwt = require('jsonwebtoken');
const async = require('async');

const config = require('../config.json');

const databases = require('./database');


var users = {
    users: {},

    userConnected: (socket) => {
        socket.on('authenticate', (data) => users.userAuthenticate(socket, data));
        socket.on('playing', (data) => users.trackProgress(socket, data));

        socket.on('disconnect', () => {
            if (socket.authentication)
                users.userRemove(socket.authentication);
        })
    },

    userAuthenticate: (socket, data) => {
        jwt.verify(data.token, config.authentication.secret, function (err, decoded) {
            if (err)
                return false;

            console.log(decoded);

            // Add user first into memory if the user isn't there
            users.userAdd(decoded);

            users.users[decoded.username].socket = socket;

            socket.authentication = decoded;
        });
    },

    userRemove: (authentication) => {
        if (!users.users[authentication.username])
            return false;

        delete users.users[authentication.username];
    },

    userAdd: (authentication) => {
        if (users.users[authentication.username])
            return false;

        users.users[authentication.username] = {
            storage: {}
        };

        // Load the progress of the newly added user
        users.loadProgress(authentication);
    },

    loadProgress: (authentication) => {
        databases.track.findAll({ where: { userId: authentication.id } }).then(tracks => {
            tracks.forEach((v) => {
                let item = v.toJSON();
                users.users[authentication.username].storage[item.tvshowId] = {
                    time: item.time,
                    progress: item.progress,
                    tvshow: item.tvshowId
                }
            })
        })
    },


    // Save progress of a user to memory
    trackProgress: (socket, data) => {
        if (!socket.authentication)
            return false;
        if (data.time && data.time > 0)
            users.users[socket.authentication.username]['storage'][data.tvshow] = data;
    },

    // Save the temporary storage of a show into the MySQL database
    saveUserProgress: (username, callback) => {
        let userInfo = users.users[username];
        let storage = userInfo.storage;

        if (!userInfo.socket)
            return false;

        async.each(storage,
            (show, callback) => {
                databases.track.findOrCreate({
                    where: {
                        userId: userInfo.socket.authentication.id,
                        tvshowId: show.tvshow
                    },
                    defaults: {
                        time: show.time,
                        progress: show.progress
                    }
                }).spread((item, created) => {
                    item.updateAttributes({
                        time: show.time,
                        progress: show.progress
                    });

                    callback();
                })
            }, callback)
    },

    // Run saveUserProgress on all keys in the users array
    saveAllUserProgress: (callback) => async.each(Object.keys(users.users), users.saveUserProgress, callback),

    // Method to check if a certain user has save progress in a show
    hasSavedProgress: (username, tvid) => {
        return users.users[username]['storage'][tvid] !== undefined
    },

    getSavedProgress: (username, tvid) => {
        return users.users[username]['storage'][tvid]
    },

    // Function to send a message to all users
    sendToAll: (channel, message) => {
        async.each(users.users, (user) => {
            user.socket.emit(channel, message)
        }, () => {

        });
    }
};

module.exports = users;