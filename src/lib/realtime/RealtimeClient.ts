import { saveProgress } from '../playback/progress.js';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import logger from '../../submodules/logger/index.js';

import type { Socket } from 'socket.io';
import type Oblecto from '../oblecto/index.js';

type AuthUser = {
    id: number;
} & Record<string, unknown>;

type EpisodePlayback = {
    episodeId: string;
    time: number;
    progress: number;
    type: 'tv';
};

type MoviePlayback = {
    movieId: string;
    time: number;
    progress: number;
    type: 'movie';
};

type PlaybackData = EpisodePlayback | MoviePlayback;

export default class RealtimeClient extends EventEmitter {
    public clientName: string;
    public oblecto: Oblecto;
    public socket: Socket;
    public user: AuthUser | null;
    private saveTimer: NodeJS.Timeout;
    private disconnectSave?: Promise<void>;
    public storage: {
        series: Record<string, EpisodePlayback>;
        movie: Record<string, MoviePlayback>;
    };

    /**
     * @param oblecto - Oblecto server instance
     * @param socket - Realtime socket.io socket
     */
    constructor(oblecto: Oblecto, socket: Socket) {
        super();

        this.clientName = 'default';

        this.oblecto = oblecto;
        this.socket = socket;
        this.user = null;

        this.storage = {
            series: {},
            movie: {}
        };

        this.socket.on('authenticate', (data: { token: string }) => this.authenticationHandler(data));
        this.socket.on('playing', (data: PlaybackData) => this.playingHandler(data));
        this.socket.on('disconnect', () => this.disconnectHandler());

        this.saveTimer = setInterval(() => {
            void this.saveAllTracks().catch(error => logger.warn("Progress save failed", error));
        }, 10000);
    }

    authenticationHandler(data: { token: string }): void {
        try {
            this.user = jwt.verify(data.token, this.oblecto.config.authentication.secret) as AuthUser;
        } catch (e) {
            logger.warn( 'An unauthorized user attempted connection to realtime server');
            logger.warn( 'Disconnecting client...');

            this.socket.disconnect();
        }
    }

    playingHandler(data: PlaybackData): void {
        if (this.user == null) return;
        if (data.type === 'tv') return this.playingEpisodeHandler(data);
        if (data.type === 'movie') return this.playingMovieHandler(data);
    }

    playingEpisodeHandler(data: EpisodePlayback): void {
        this.storage.series[data.episodeId] = data;
    }

    playingMovieHandler(data: MoviePlayback): void {
        this.storage.movie[data.movieId] = data;
    }

    async disconnect(): Promise<void> {
        this.socket.disconnect();
        await this.disconnectHandler();
    }

    disconnectHandler(): Promise<void> {
        if (this.disconnectSave) return this.disconnectSave;
        clearInterval(this.saveTimer);
        this.disconnectSave = this.saveAllTracks().catch(error => { logger.warn('Progress save failed', error); });
        this.emit('disconnect');
        return this.disconnectSave;
    }

    async saveEpisodeTrack(id: string): Promise<void> {
        const payload = this.storage.series[id];
        if (!this.user || !payload || !Number.isFinite(payload.time) || payload.time < 0) return;
        await saveProgress(this.user.id, 'episode', Number(id), payload.time, payload.progress > 0 ? payload.time / payload.progress : 0);
        if (this.storage.series[id] === payload) delete this.storage.series[id];
    }
    async saveMovieTrack(id: string): Promise<void> {
        const payload = this.storage.movie[id];
        if (!this.user || !payload || !Number.isFinite(payload.time) || payload.time < 0) return;
        await saveProgress(this.user.id, 'movie', Number(id), payload.time, payload.progress > 0 ? payload.time / payload.progress : 0);
        if (this.storage.movie[id] === payload) delete this.storage.movie[id];
    }

    async saveAllTracks(): Promise<void> {
        for (const i of Object.keys(this.storage.series)) {
            await this.saveEpisodeTrack(i);
        }

        for (const i of Object.keys(this.storage.movie)) {
            await this.saveMovieTrack(i);
        }
    }

    async playEpisode(episodeId: string): Promise<void> {
        this.socket.emit('play', { episodeId });
    }

    async playMovie(movieId: string): Promise<void> {
        this.socket.emit('play', { movieId });
    }
}
