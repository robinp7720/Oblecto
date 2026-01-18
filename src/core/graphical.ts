import blessed from 'neo-blessed';

import Oblecto from '../lib/oblecto/index.js';
import config from '../config.js';
import logger from '../submodules/logger/index.js';

type SessionMap = Record<string, {
    constructor: { name: string };
    file: { path: string };
    videoCodec?: string | null;
    audioCodec?: string | null;
    offset?: number | null;
}>;

type ClientSession = {
    user: unknown | null;
    storage: unknown;
};

type Task = {
    id: string;
    attr: Record<string, unknown> & {
        path?: string;
        airedSeason?: string | number;
        airedEpisodeNumber?: string | number;
        episodeName?: string;
        movieName?: string;
        seriesName?: string;
    };
};

const graphical = {
    oblecto: null as Oblecto | null,
    screen: blessed.screen({ smartCSR: true }),
    streamerSessionsBox: null as ReturnType<typeof blessed.list> | null,
    queueBox: null as ReturnType<typeof blessed.list> | null,
    logBox: null as ReturnType<typeof blessed.list> | null,
    sessionBox: null as ReturnType<typeof blessed.list> | null,
    updater: null as NodeJS.Timeout | null,

    initScreen(): void {
        // Create a screen object.

        this.screen.title = 'my window title';

        // Create a box perfectly centered horizontally and vertically.
        this.streamerSessionsBox = blessed.list({
            top: 0,
            left: 0,
            width: '50%',
            height: '50%',
            content: '',
            label: 'Active Streaming Sessions: 0',
            tags: true,
            border: { type: 'line' }
        });

        this.queueBox = blessed.list({
            top: '50%',
            left: 0,
            width: '50%',
            height: '50%',
            content: '',
            label: 'Queue: 0',
            tags: true,
            border: { type: 'line' }
        });

        this.logBox = blessed.list({
            top: 0,
            left: '50%',
            width: '50%',
            height: '50%',
            content: '',
            label: 'Log',
            tags: true,
            border: { type: 'line' }
        });

        this.sessionBox = blessed.list({
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%',
            content: '',
            label: 'Web Socket Sessions',
            tags: true,
            border: { type: 'line' }
        });

        // Append our box to the screen.
        this.screen.append(this.streamerSessionsBox);
        this.screen.append(this.queueBox);
        this.screen.append(this.logBox);
        this.screen.append(this.sessionBox);

        this.screen.render();
    },

    start(): void {
        this.initScreen();

        logger.silent = true;

        logger.on('log', (log: unknown) => {
            if (!this.logBox) return;

            if (log instanceof Error) {
                const error = log as Error & { level?: string };

                this.logBox.addItem(`[${error.level ?? 'ERROR'}] ${error.message}`);
            } else {
                const entry = log as { level?: string; messages?: unknown[] };
                const level = entry.level ?? 'INFO';
                const messages = Array.isArray(entry.messages) ? entry.messages.join(' ') : '';

                this.logBox.addItem(`[${level}] ${messages}`);
            }

            this.logBox.down(1);
            this.screen.render();
        });

        this.oblecto = new Oblecto(config);

        this.updater = setInterval(() => {
            this.renderStreamerSessions();
            this.renderQueue();
            this.renderSessions();
            this.screen.render();
        }, 1000);
    },

    close(): void {
        this.oblecto?.close();
        if (this.updater) {
            clearInterval(this.updater);
        }
        this.screen.destroy();
    },

    renderStreamerSessions(): void {
        if (!this.oblecto || !this.streamerSessionsBox) return;

        this.streamerSessionsBox.clearItems();

        const sessions = this.oblecto.streamSessionController.sessions as SessionMap;

        this.streamerSessionsBox.setLabel('Active Streaming Sessions: ' + Object.keys(sessions).length);

        for (const sessionId of Object.keys(sessions)) {
            const session = sessions[sessionId];

            this.streamerSessionsBox.addItem(session.constructor.name + ':');
            this.streamerSessionsBox.addItem(sessionId);
            this.streamerSessionsBox.addItem(session.file.path);
            this.streamerSessionsBox.addItem('VideoCodec: ' + session.videoCodec + ', AudioCodec: ' + session.audioCodec + ', Offset:' + session.offset);
            this.streamerSessionsBox.addItem(' ');
        }
    },

    renderQueue(): void {
        if (!this.oblecto || !this.queueBox) return;

        this.queueBox.clearItems();

        const tasks = (this.oblecto.queue.queue as { _tasks?: Task[] })._tasks ?? [];

        this.queueBox.setLabel('Queue: ' + tasks.length);

        for (const task of tasks) {
            if ((task as unknown as number) > 100) break;

            switch (task.id) {
                case 'indexEpisode':
                    this.queueBox.addItem('Index Episode: ' + task.attr.path);
                    break;
                case 'indexMovie':
                    this.queueBox.addItem('Index Episode: ' + task.attr.path);
                    break;
                case 'updateEpisode':
                    this.queueBox.addItem('Update Episode: S' + task.attr.airedSeason + 'E' + task.attr.airedEpisodeNumber + ' ' + task.attr.episodeName);
                    break;
                case 'downloadEpisodeBanner':
                    this.queueBox.addItem('Episode Banner: S' + task.attr.airedSeason + 'E' + task.attr.airedEpisodeNumber + ' ' + task.attr.episodeName);
                    break;
                case 'updateMovie':
                    this.queueBox.addItem('Update Movie: ' + task.attr.movieName);
                    break;
                case 'updateSeries':
                    this.queueBox.addItem('Update Movie: ' + task.attr.seriesName);
                    break;
                default:
                    this.queueBox.addItem(task.id + ' - ' + JSON.stringify(task.attr));
            }
        }
    },

    renderSessions(): void {
        if (!this.oblecto || !this.sessionBox) return;

        this.sessionBox.clearItems();

        const clients = this.oblecto.realTimeController.clients as Record<string, ClientSession>;

        this.sessionBox.setLabel('Web Socket sessions: ' + Object.keys(clients).length);

        for (const sessionId of Object.keys(clients)) {
            const client = clients[sessionId];

            this.sessionBox.addItem('Session Id: ' + sessionId);

            if (client.user === null)
                this.sessionBox.addItem('Session is not authenticated');
            else
                this.sessionBox.addItem('User:' + JSON.stringify(client.user));

            this.sessionBox.addItem('Details:' + JSON.stringify(client.storage));

            this.sessionBox.addItem(' ');
        }
    }
};

export default graphical;
