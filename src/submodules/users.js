import jwt from 'jsonwebtoken';
import async from 'promise-async';
import config from '../config.json';
import databases from './database';

export default {
    users: {},

    userConnected (socket) {
        socket.on('authenticate', (data) => this.userAuthenticate(socket, data));
        socket.on('playing', (data) => this.trackProgress(socket, data));

        socket.on('disconnect', () => {
            if (socket.authentication) {
                this.socketDisconnect(socket);
            }
        });
    },

    userAuthenticate (socket, data) {
        jwt.verify(data.token, config.authentication.secret, (err, decoded) => {
            if (err)
                return false;

            if (socket.authentication)
                return false;

            // Add user first into memory if the user isn't there
            this.userAdd(decoded);

            // Save socket to user storage
            this.users[decoded.username].sockets[socket.id] = socket;

            // Add decoded jwt token to socket
            socket.authentication = decoded;
        });
    },

    socketDisconnect (socket) {
        // Ignore if the socket wasn't authenticated
        if (!socket.authentication)
            return false;

        if (!this.users[socket.authentication.username])
            return false;

        // Remove the socket from the user
        delete this.users[socket.authentication.username].sockets[socket.id];

        // If there are no open sockets for the user, delete the user entity
        if (this.users[socket.authentication.username].sockets.length < 1)
            delete this.users[socket.authentication.username];
    },

    userAdd (authentication) {
        // Return if the user already exists to avoid overwriting an exist user session
        if (this.users[authentication.username])
            return false;

        this.users[authentication.username] = {
            storage: {
                tv: {},
                movies: {}
            },
            sockets: {},
            id: authentication.id
        };

        // Load the progress of the newly added user
        this.loadProgress(authentication);
    },

    async loadProgress (authentication) {
        // Load progress for TV shows
        let episodeTracks = await databases.trackEpisodes.findAll({where: {userId: authentication.id}});

        episodeTracks.forEach(v => {
            let item = v.toJSON();
            this.users[authentication.username].storage['tv'][item.episodeId] = {
                time: item.time,
                progress: item.progress,
                tvshowId: item.tvshowId,
                episodeId: item.episodeId
            };
        });

        // Load progress for Movies
        let movieTracks = await databases.trackMovies.findAll({where: {userId: authentication.id}});

        movieTracks.forEach(v => {
            let item = v.toJSON();
            this.users[authentication.username].storage['movies'][item.movieId] = {
                time: item.time,
                progress: item.progress,
                movieId: item.movieId
            };
        });
    },


    // Save progress of a user to memory
    trackProgress (socket, data) {
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
        if (data.type === 'tv') {
            if (!data.episodeId ||
                !data.tvshowId  ||
                !data.progress  ||
                !data.time) {
                return false;
            }

            this.users[socket.authentication.username]['storage']['tv'][data.episodeId] = {
                time: data.time,
                progress: data.progress,
                tvshowId: data.tvshowId,
                episodeId: data.episodeId
            };
        }

        // If the item is a movie, store it in the movie temp storage of the user
        if (data.type === 'movie') {
            if (!data.movieId ||
                !data.progress  ||
                !data.time) {
                return false;
            }

            this.users[socket.authentication.username]['storage']['movies'][data.movieId] = {
                time: data.time,
                progress: data.progress,
                movieId: data.movieId
            };
        }
    },

    async saveUserEpisodeProgress (username) {
        let userInfo = this.users[username];
        let storage = userInfo.storage;

        return await async.each(storage['tv'],
            async show => {
                let [item, created] = await databases.trackEpisodes.findOrCreate({
                    where: {
                        userId: userInfo.id,
                        episodeId: show.episodeId
                    },
                    defaults: {
                        time: show.time,
                        progress: show.progress
                    }
                });

                item.updateAttributes({
                    time: show.time,
                    progress: show.progress
                });

                return created;
            });
    },

    async saveUserMovieProgress (username) {
        let userInfo = this.users[username];
        let storage = userInfo.storage;

        return await async.each(storage['movies'],
            async movie => {
                let [item, created] = await databases.trackMovies.findOrCreate({
                    where: {
                        userId: userInfo.id,
                        movieId: movie.movieId
                    },
                    defaults: {
                        time: movie.time,
                        progress: movie.progress
                    }
                });

                item.updateAttributes({
                    time: movie.time,
                    progress: movie.progress
                });

                return created;
            });
    },

    // Save the temporary storage of a show into the MySQL database
    async saveUserProgress (username) {
        this.saveUserEpisodeProgress(username);
        this.saveUserMovieProgress(username);
    },

    // Run saveUserProgress on all keys in the users array
    saveAllUserProgress () {
        Object.entries(this.users).forEach(([username, user]) => {
            this.saveUserProgress(username);
        });
    },

    // Method to check if a certain user has save progress in a show
    hasSavedTVProgress (username, episodeId) {
        return this.users[username]['storage']['tv'][episodeId] !== undefined;
    },

    getSavedTVProgress (username, episodeId) {
        return this.users[username]['storage']['tv'][episodeId];
    },

    // Method to check if a certain user has save progress in a movie
    hasSavedMovieProgress (username, movieId) {
        return this.users[username]['storage']['movies'][movieId] !== undefined;
    },

    getSavedMovieProgress (username, movieId) {
        return this.users[username]['storage']['movies'][movieId];
    },

    // Function to send a message to all users
    sendToAll (channel, message) {
        async.each(this.users, (user) => {
            async.each(user.sockets, (socket) => {
                socket.emit(channel, message);
            }, () => {

            });
        }, () => {

        });
    }
};
