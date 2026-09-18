import blessed from 'neo-blessed';

import Oblecto from '../lib/oblecto/index.js';
import config from '../config.js';
import logger from '../submodules/logger/index.js';

type TaskAttr = {
    path?: string;
    airedSeason?: string | number;
    airedEpisodeNumber?: string | number;
    episodeName?: string;
    movieName?: string;
    seriesName?: string;
};

const QUEUE_DISPLAY_LIMIT = 100;

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

    async close(): Promise<void> {
        await this.oblecto?.close();
        if (this.updater) {
            clearInterval(this.updater);
        }
        this.screen.destroy();
    },

    renderStreamerSessions(): void {
        if (!this.oblecto || !this.streamerSessionsBox) return;

        this.streamerSessionsBox.clearItems();

        const sessions = this.oblecto.playback.diagnostics();
        this.streamerSessionsBox.setLabel('Active Streaming Sessions: ' + sessions.length);
        for (const session of sessions) {
            this.streamerSessionsBox.addItem(`${String(session.sessionId)}: ${String(session.method)} (${String(session.state)})`);
        }
    },

    renderQueue(): void {
        if (!this.oblecto || !this.queueBox) return;

        this.queueBox.clearItems();

        this.queueBox.setLabel('Queue: ' + this.oblecto.queue.getStats().length);

        for (const task of this.oblecto.queue.pending(QUEUE_DISPLAY_LIMIT)) {
            const attr = (task.attr ?? {}) as TaskAttr;

            switch (task.id) {
                case 'indexEpisode':
                    this.queueBox.addItem('Index Episode: ' + attr.path);
                    break;
                case 'indexMovie':
                    this.queueBox.addItem('Index Movie: ' + attr.path);
                    break;
                case 'updateEpisode':
                    this.queueBox.addItem('Update Episode: S' + attr.airedSeason + 'E' + attr.airedEpisodeNumber + ' ' + attr.episodeName);
                    break;
                case 'downloadEpisodeBanner':
                    this.queueBox.addItem('Episode Banner: S' + attr.airedSeason + 'E' + attr.airedEpisodeNumber + ' ' + attr.episodeName);
                    break;
                case 'updateMovie':
                    this.queueBox.addItem('Update Movie: ' + attr.movieName);
                    break;
                case 'updateSeries':
                    this.queueBox.addItem('Update Series: ' + attr.seriesName);
                    break;
                default:
                    this.queueBox.addItem(task.id + ' - ' + JSON.stringify(task.attr));
            }
        }
    },

    renderSessions(): void {
        if (!this.oblecto || !this.sessionBox) return;

        this.sessionBox.clearItems();

        const devices = this.oblecto.realTimeController.registry.all();

        this.sessionBox.setLabel('Connected devices: ' + devices.length);

        for (const device of devices) {
            this.sessionBox.addItem(device.name + ' (' + device.deviceId + ')');
            this.sessionBox.addItem('User: ' + device.userId + ' | Can play: ' + (device.capabilities.includes('playback') ? 'yes' : 'no'));

            const state = device.state;

            if (state.status === 'idle' || !state.media)
                this.sessionBox.addItem('Idle');
            else
                this.sessionBox.addItem(state.status + ': ' + (state.media.title ?? state.media.kind + ' ' + state.media.id) + ' @ ' + Math.round(state.position) + 's');

            this.sessionBox.addItem(' ');
        }
    }
};

export default graphical;
