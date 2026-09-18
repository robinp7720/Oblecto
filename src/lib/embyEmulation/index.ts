import type { PlaybackState } from './ServerAPI/playbackState.js';
import EmbyServerAPI from './ServerAPI/index.js';

import { createHash } from 'node:crypto';
import { User } from '../../models/user.js';
import { checkLogin } from '../auth/loginPolicy.js';
import { issueJellyfinToken, verifyJellyfinToken } from '../auth/tokens.js';
import Primus, { Spark } from 'primus';
import logger from '../../submodules/logger/index.js';

import type Oblecto from '../oblecto/index.js'

type SessionInfo = {
    playbackState?: PlaybackState;
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
    client: ClientInfo;
    // When the token was last checked against the user, and when the client was last seen
    checkedAt: number;
    lastSeen: number;
};

export type ClientInfo = {
    Client?: string;
    Device?: string;
    DeviceId?: string;
    Version?: string;
    RemoteEndPoint?: string;
};

type WebsocketSessions = Record<string, unknown>;

// The Jellyfin API version clients are told they are talking to. They gate features on it.
export const JELLYFIN_API_VERSION = '10.11.5';

// Tokens are re-verified this often, so a password change, deletion or demotion reaches cached sessions.
const RECHECK_MS = 60 * 1000;
// Sessions idle this long are dropped from memory; the token still works and rebuilds the session.
const IDLE_MS = 24 * 60 * 60 * 1000;

export default class EmbyEmulation {
    public oblecto: Oblecto;
    public sessions: Record<string, SessionInfo>;
    public websocketSessions: WebsocketSessions;
    public serverId: string;
    public version: string;
    public serverName: string;
    public serverAPI: EmbyServerAPI;
    public primus: Primus;
    private sweeper: NodeJS.Timeout;
    // Tokens signed out since start. Tokens are stateless, so this only holds until a restart;
    // changing the password is what revokes every token for good.
    private revoked = new Set<string>();

    /**
     * Create a new Emby emulation server
     * @param oblecto - The main Oblecto instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};

        this.websocketSessions = {};

        // Stable for this install, different between installs, so clients that know several servers
        // keep them apart. Derived from the signing secret, which already has to stay put.
        this.serverId = createHash('sha256').update(`jellyfin-server-id:${oblecto.config.authentication.secret}`).digest('hex').slice(0, 32);
        this.version = JELLYFIN_API_VERSION;

        this.serverName = 'Oblecto';

        this.serverAPI = new EmbyServerAPI(this);

        this.sweeper = setInterval(() => this.sweep(), 60 * 60 * 1000);
        this.sweeper.unref();

        const apiKeyOf = (req: unknown): string | undefined => (req as { query?: Record<string, string> }).query?.api_key;

        this.primus = new Primus(this.serverAPI.server, {
            pathname: '/socket',
            authorization: (req, done) => {
                this.resolveSession(apiKeyOf(req)).then(session => {
                    if (!session) return done({ statusCode: 403, message: '' });
                    done();
                }).catch(() => done({ statusCode: 403, message: '' }));
            }
        });

        this.primus.on('connection', (spark: Spark) => {
            const token = apiKeyOf(spark.request);

            if (!token || !this.sessions[token])
                return spark.end(undefined, { reconnect: false });

            this.websocketSessions[token] = spark;

            spark.on('end', () => {
                if (this.websocketSessions[token] === spark) delete this.websocketSessions[token];
            });

            spark.on('data', function message(data: unknown) {
                logger.debug('jellyfin ws received:', data);
            });
        });
    }

    close(): Promise<void> {
        clearInterval(this.sweeper);

        return new Promise(resolve => this.primus.destroy({
            close: true, reconnect: false, timeout: 1000
        }, resolve));
    }

    private sessionFor(user: User, client: ClientInfo = {}): SessionInfo {
        const now = Date.now();
        const HasPassword = Boolean(user.password);

        return {
            Name: user.name,
            ServerId: this.serverId,
            Id: user.id,
            HasPassword,
            HasConfiguredPassword: HasPassword,
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: false,
            LastLoginDate: new Date(now).toISOString(),
            LastActivityDate: new Date(now).toISOString(),
            capabilities: {},
            client,
            checkedAt: now,
            lastSeen: now
        };
    }

    /**
     * Handles user login by authenticating credentials and creating a session.
     * @param username - The username for login.
     * @param password - The password for login.
     * @param local - Whether the client is on the local network (enables password-less sign-in).
     * @param client - What the client said about itself in its authorization header.
     * @returns A promise that resolves with the access token if login is successful.
     * @throws If the username is incorrect or the password does not match.
     */
    async handleLogin(username: string, password: string | undefined, local = false, client: ClientInfo = {}): Promise<string> {
        const user = await User.findOne({ where: { username } });

        if (!user) throw Error('Incorrect username');

        if (!await checkLogin(user, password, local, this.oblecto.config.authentication))
            throw Error('Password incorrect');

        const token = issueJellyfinToken(user, this.oblecto.config.authentication.secret);

        this.sessions[token] = this.sessionFor(user, client);

        return token;
    }

    /**
     * The session a token belongs to, or null. Tokens survive restarts: an unknown but valid token
     * rebuilds its session. Known ones are re-checked every minute against the user.
     */
    async resolveSession(token: string | undefined): Promise<SessionInfo | null> {
        if (!token || this.revoked.has(token)) return null;

        const now = Date.now();
        const cached = this.sessions[token];

        if (cached && now - cached.checkedAt < RECHECK_MS) {
            cached.lastSeen = now;
            cached.LastActivityDate = new Date(now).toISOString();
            return cached;
        }

        const user = await verifyJellyfinToken(token, this.oblecto.config.authentication.secret);

        if (!user) {
            this.endSession(token);
            return null;
        }

        if (cached) {
            cached.Name = user.name;
            cached.checkedAt = now;
            cached.lastSeen = now;
            cached.LastActivityDate = new Date(now).toISOString();
            return cached;
        }

        this.sessions[token] = this.sessionFor(user);

        return this.sessions[token];
    }

    /** Forget a session and close its socket. The client has to sign in again. */
    endSession(token: string, revoke = false): void {
        if (revoke) this.revoked.add(token);
        delete this.sessions[token];

        const spark = this.websocketSessions[token] as Spark | undefined;

        if (spark) spark.end(undefined, { reconnect: false });
        delete this.websocketSessions[token];
    }

    private sweep(): void {
        const cutoff = Date.now() - IDLE_MS;

        for (const [token, session] of Object.entries(this.sessions)) {
            if (session.lastSeen < cutoff && !this.websocketSessions[token]) delete this.sessions[token];
        }
    }
}
