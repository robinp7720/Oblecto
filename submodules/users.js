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
                users.socketDisconnect(socket);
        })
    },

    userAuthenticate: (socket, data) => {
        jwt.verify(data.token, config.authentication.secret, function (err, decoded) {
            if (err)
                return false;

            // Add user first into memory if the user isn't there
            users.userAdd(decoded);

            // Save socket to user storage
            users.users[decoded.username].sockets[socket.id] = socket;

            // Add decoded jwt token to socket
            socket.authentication = decoded;
        });
    },

    socketDisconnect: (socket) => {
        // Ignore if the socket wasn't authenticated
        if (!socket.authentication)
            return false;

        if (!users.users[socket.authentication.username])
            return false;

        // Remove the socket from the user
        delete users.users[socket.authentication.username].sockets[socket.id];

        // If there are no open sockets for the user, delete the user entity
        if (users.users[socket.authentication.username].sockets.length < 1)
            delete users.users[authentication.username]
    },

    userAdd: (authentication) => {
        // Return if the user already exists to avoid overwriting an exist user session
        if (users.users[authentication.username])
            return false;

        users.users[authentication.username] = {
            storage: {
                tv: {},
                movies: {}
            },
            sockets: {},
            id: authentication.id
        };

        // Load the progress of the newly added user
        users.loadProgress(authentication);
    },

    loadProgress: (authentication) => {
        // Load progress for TV shows
        databases.track.findAll({ where: { userId: authentication.id } }).then(tracks => {
            tracks.forEach((v) => {
                let item = v.toJSON();
                users.users[authentication.username].storage['tv'][item.episodeId] = {
                    time: item.time,
                    progress: item.progress,
                    tvshowId: item.tvshowId,
                    episodeId: item.episodeId
                }
            })
        })
    },


    // Save progress of a user to memory
    trackProgress: (socket, data) => {
        // Return if the user is not authenticated
        if (!socket.authentication)
            return false;

        // Return if the type is not defined
        if (data.type === undefined)
            return false;

        // Return if the time is not defined or if the time is 0 as this generally means that the video has not yet been loaded
        if (data.time === undefined || data.time === 0)
            return false;

        // If the item is a tv show episode, store it in the tv show temp storage of the user
        if (data.type === 'tv')
            return users.users[socket.authentication.username]['storage']['tv'][data.episodeId] = {
                time: data.time,
                progress: data.progress,
                tvshowId: data.tvshowId,
                episodeId: data.episodeId
            };

        // If the item is a movie, store it in the movie temp storage of the user
        if (data.type === 'movie')
            return users.users[socket.authentication.username]['movie'][data.movieId] = {
                time: data.time,
                progress: data.progress,
                movieId: data.movieId
            };
    },

    // Save the temporary storage of a show into the MySQL database
    saveUserProgress: (username, callback) => {
        let userInfo = users.users[username];
        let storage = userInfo.storage;

        async.each(storage['tv'],
            (show, callback) => {
                databases.track.findOrCreate({
                    where: {
                        userId: userInfo.id,
                        episodeId: show.episodeId
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
    hasSavedProgress: (username, episodeId) => {
        return users.users[username]['storage']['tv'][episodeId] !== undefined
    },

    getSavedProgress: (username, episodeId) => {
        return users.users[username]['storage']['tv'][episodeId]
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