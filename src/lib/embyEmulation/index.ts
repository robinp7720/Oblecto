import EmbyServerAPI from './ServerAPI/index.js';

import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models/user.js';
import bcrypt from 'bcrypt';
import Primus from 'primus';
import { timeout } from 'async';
import logger from '../../submodules/logger/index.js';

import type Oblecto from '../oblecto/index.js';

type SessionInfo = {
    Name: string | null;
    ServerId: string;
    Id: number;
    HasPassword: boolean;
    HasConfiguredPassword: boolean;
    HasConfiguredEasyPassword: boolean;
    EnableAutoLogin: boolean;
    LastLoginDate: string;
    LastActivityDate: string;
    capabilities: Record<string, unknown>;
};

type WebsocketSessions = Record<string, unknown>;

export default class EmbyEmulation {
    public oblecto: Oblecto;
    public sessions: Record<string, SessionInfo>;
    public websocketSessions: WebsocketSessions;
    public serverId: string;
    public version: string;
    public serverName: string;
    public serverAPI: EmbyServerAPI;
    public primus: Primus;

    /**
     *
     * @param oblecto
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};

        this.websocketSessions = {};

        this.serverId = 'cadda85fd4f447b9ad3ccc3c83cf1cf6';
        this.version = '10.6.4';

        this.serverName = 'Oblecto';

        this.serverAPI = new EmbyServerAPI(this);

        this.primus = new Primus(this.serverAPI.server, {
            pathname: '/socket',
            authorization: function (req, done) {
                const request = req as { query?: Record<string, string> };

                if (!request.query?.api_key)
                    return done({ statusCode: 403, message: '' });

                (this as { auth?: string }).auth = 'test';

                done();
            }
        });

        this.primus.on('connection', (spark: any) => {
            const req = spark.request as { query?: Record<string, string> };

            if (!req.query?.api_key)
                return spark.disconnect();

            this.websocketSessions[req.query.api_key] = spark;

            console.log('jellyfin ws client connected');

            timeout(() => {
                console.log('sending');
                spark.write({
                    MessageType: 'Play',
                    Data: {
                        VolumeLevel: 100,
                        IsMuted: false,
                        IsPaused: false,
                        RepeatMode: 'RepeatNone',
                        ShuffleMode: 'Sorted',
                        MaxStreamingBitrate: 140000000,
                        PositionTicks: 0,
                        PlaybackStartTimeTicks: 15999190139560000,
                        SubtitleStreamIndex: 2,
                        AudioStreamIndex: 1,
                        BufferedRanges: [],
                        PlayMethod: 'DirectStream',
                        PlaySessionId: 'Thisisafuckingtest',
                        PlaylistItemId: 'playlistItem1',
                        MediaSourceId: 2725,
                        CanSeek: true,
                        ItemId: 'movie16',
                        NowPlayingQueue: [{ Id: 'movie16', PlaylistItemId: 'playlistItem1' }]
                    }
                });
            }, 2000);

            spark.on('data', function message(data: unknown) {
                logger.debug('jellyfin ws recevied:', data);
            });
        });
    }

    async handleLogin(username: string, password: string): Promise<string> {
        const user = await User.findOne({
            where: { username },
            attributes: ['username', 'name', 'email', 'password', 'id']
        });

        if (!user) throw Error('Incorrect username');

        if (!await bcrypt.compare(password, user.password))
            throw Error('Password incorrect');

        const HasPassword = user.password !== '';

        const sessionId = uuidv4();

        this.sessions[sessionId] = {
            Name: user.name,
            ServerId: this.serverId,
            Id: user.id,
            HasPassword,
            HasConfiguredPassword: HasPassword,
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: false,
            LastLoginDate: '2020-09-11T23:37:27.3042432Z',
            LastActivityDate: '2020-09-11T23:37:27.3042432Z',
            capabilities: {}
        };

        return sessionId;
    }
}
