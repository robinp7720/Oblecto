import blessed from 'neo-blessed';

import Oblecto from '../lib/oblecto';
import config from '../config';
import logger from '../submodules/logger';


export default {
    oblecto: null,
    screen: blessed.screen({
        smartCSR: true
    }),

    initScreen() {
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
            border: {
                type: 'line'
            }
        });

        this.queueBox = blessed.list({
            top: '50%',
            left: 0,
            width: '50%',
            height: '50%',
            content: '',
            label: 'Queue: 0',
            tags: true,
            border: {
                type: 'line'
            }
        });

        this.logBox = blessed.list({
            top: 0,
            left: '50%',
            width: '50%',
            height: '50%',
            content: '',
            label: 'Log',
            tags: true,
            border: {
                type: 'line'
            }
        });

        this.sessionBox = blessed.list({
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%',
            content: '',
            label: 'Web Socket Sessions',
            tags: true,
            border: {
                type: 'line'
            }
        });

        // Append our box to the screen.
        this.screen.append(this.streamerSessionsBox);
        this.screen.append(this.queueBox);
        this.screen.append(this.logBox);
        this.screen.append(this.sessionBox);

        this.screen.render();
    },

    start() {
        this.initScreen();

        logger.silent = true;

        logger.on('log', (log) => {
            if (log instanceof Error) {
                this.logBox.addItem(`[${log.level}] ${log.message}`);
            } else {
                this.logBox.addItem(`[${log.level}] ${log.messages.join(' ')}`);
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

    close() {
        this.oblecto.close();
        clearInterval(this.updater);
        this.screen.destroy();
    },

    renderStreamerSessions() {
        this.streamerSessionsBox.clearItems();

        this.streamerSessionsBox.setLabel('Active Streaming Sessions: '+ Object.keys(this.oblecto.streamSessionController.sessions).length);


        for (let sessionId of Object.keys(this.oblecto.streamSessionController.sessions)) {
            this.streamerSessionsBox.addItem(this.oblecto.streamSessionController.sessions[sessionId].constructor.name + ':');
            this.streamerSessionsBox.addItem(sessionId);
            this.streamerSessionsBox.addItem(this.oblecto.streamSessionController.sessions[sessionId].file.path);
            this.streamerSessionsBox.addItem('VideoCodec: ' + this.oblecto.streamSessionController.sessions[sessionId].videoCodec + ', AudioCodec: ' + this.oblecto.streamSessionController.sessions[sessionId].audioCodec + ', Offset:' + this.oblecto.streamSessionController.sessions[sessionId].offset);
            this.streamerSessionsBox.addItem(' ');
        }
    },

    renderQueue() {
        this.queueBox.clearItems();

        this.queueBox.setLabel('Queue: '+ this.oblecto.queue.queue._tasks.length);

        for (let i of this.oblecto.queue.queue._tasks) {
            if (i > 100) break;

            switch (i.id) {
                case 'indexEpisode':
                    this.queueBox.addItem('Index Episode: ' + i.attr.path);
                    break;
                case 'indexMovie':
                    this.queueBox.addItem('Index Episode: ' + i.attr.path);
                    break;
                case 'updateEpisode':
                    this.queueBox.addItem('Update Episode: S' + i.attr.airedSeason + 'E' + i.attr.airedEpisodeNumber + ' ' + i.attr.episodeName);
                    break;
                case 'downloadEpisodeBanner':
                    this.queueBox.addItem('Episode Banner: S' + i.attr.airedSeason + 'E' + i.attr.airedEpisodeNumber + ' ' + i.attr.episodeName);
                    break;
                case 'updateMovie':
                    this.queueBox.addItem('Update Movie: ' + i.attr.movieName);
                    break;
                case 'updateSeries':
                    this.queueBox.addItem('Update Movie: ' + i.attr.seriesName);
                    break;
                default:
                    this.queueBox.addItem(i.id + ' - ' + JSON.stringify(i.attr));

            }
        }
    },

    renderSessions() {
        this.sessionBox.clearItems();

        this.sessionBox.setLabel('Web Socket sessions: '+ Object.keys(this.oblecto.realTimeController.clients).length);

        for (let sessionId of Object.keys(this.oblecto.realTimeController.clients)) {
            let client = this.oblecto.realTimeController.clients[sessionId];

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
