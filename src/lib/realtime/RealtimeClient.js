import jwt from 'jsonwebtoken';
import databases from '../../submodules/database';

export default class RealtimeClient {
    /**
     * @param {Oblecto} oblecto
     * @param {*} socket
     */
    constructor(oblecto, socket) {
        this.oblecto = oblecto;
        this.socket = socket;
        this.user = null;

        this.storage = {
            series: {},
            movie: {}
        };

        this.socket.on('authenticate', (data) => this.authenticationHandler(data));
        this.socket.on('playing', (data) => this.playingHandler(data));
        this.socket.on('disconnect', (data) => this.disconnectHandler(data));

        setInterval(() => {
            this.saveAllTracks();
        }, 10000);
    }

    authenticationHandler(data) {
        try {
            this.user = jwt.verify(data.token, this.oblecto.config.authentication.secret);
        } catch (e) {
            console.log('An unauthorized user attempted connection to realtime server');
            console.log('Disconnecting client...');

            this.socket.disconnect();
        }

    }

    playingHandler(data) {
        if (this.user == null) return;
        if (data.type === 'tv') return this.playingEpisodeHandler(data);
        if (data.type === 'movie') return this.playingMovieHandler(data);
    }

    playingEpisodeHandler(data) {
        this.storage.series[data.episodeId] = data;
    }

    playingMovieHandler(data) {
        this.storage.movie[data.movieId] = data;
    }

    disconnectHandler(data) {
        delete this;
    }

    async saveEpisodeTrack(id) {
        if (this.user == null) return;

        let [item, created] = await databases.trackEpisodes.findOrCreate({
            where: {
                userId: this.user.id,
                episodeId: id
            },
            defaults: {
                time: this.storage.series[id].time,
                progress: this.storage.series[id].progress
            }
        });

        if (created) return;

        item.update({
            time: this.storage.series[id].time,
            progress: this.storage.series[id].progress
        });

        delete this.storage.series[id];
    }

    async saveMovieTrack(id) {
        if (this.user == null) return;

        let [item, created] = await databases.trackMovies.findOrCreate({
            where: {
                userId: this.user.id,
                movieId: id
            },
            defaults: {
                time: this.storage.movie[id].time,
                progress: this.storage.movie[id].progress
            }
        });

        if (created) return;

        item.update({
            time: this.storage.movie[id].time,
            progress: this.storage.movie[id].progress
        });

        delete this.storage.movie[id];
    }

    async saveAllTracks() {
        for (let i in this.storage.series) {
            await this.saveEpisodeTrack(i);
        }

        for (let i in this.storage.movie) {
            await this.saveMovieTrack(i);
        }
    }
}
