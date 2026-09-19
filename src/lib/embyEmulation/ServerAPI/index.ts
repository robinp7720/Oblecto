import express, { type Request, type Response, type NextFunction, type Application } from 'express';
import routes from './routes/index.js';
import { resolveJellyfinWebPath } from './webPath.js';
import { sessionGuard } from './sessionGuard.js';
import { corsFor } from '../../network/cors.js';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import logger from '../../../submodules/logger/index.js';

import type EmbyEmulation from '../index.js';

export type EmbyRequest = Request & {
    authorization?: { scheme: string; credentials: string };
    headers: Request['headers'] & { emby?: Record<string, string> };
    // The signed-in user, set by the session check for every non-public route
    embyUserId?: number;
    embyToken?: string;
};

/**
 * Parses a header/string of the form:
 *   MediaBrowser Client="Jellyfin Media Player", Device="Living room", DeviceId="…", Version="1.12.0", Token="…"
 * into a plain JavaScript object:
 *   {
 *     Client: "Jellyfin Media Player",
 *     Device: "Living room",
 *     DeviceId: "…",
 *     Version: "1.12.0",
 *     Token: "…"
 *   }
 * @param headerStr - The raw MediaBrowser header string to parse
 */
function parseMediaBrowserHeader(headerStr: string): Record<string, string> {
    // 1) Remove the leading "MediaBrowser " (everything up to the first space)
    //    so we're left with: Client="…", Device="…", …
    const kvPart = headerStr.replace(/^[^ ]+\s*/, '');

    // 2) Use a regex to capture Key="Value" pairs
    //    (\w+) matches the key (alphanumeric/underscore)
    //    ="([^"]*)"  matches an equals sign, a double-quote, then any non-quote chars, then a closing quote
    const re = /(\w+)="([^"]*)"/g;

    const result: Record<string, string> = {};
    let match: RegExpExecArray | null;

    while ((match = re.exec(kvPart)) !== null) {
        const key = match[1];
        const value = match[2];

        result[key] = value;
    }
    return result;
}

export default class EmbyServerAPI {
    public embyEmulation: EmbyEmulation;
    public app: Application;
    public server: Server;

    /**
     * @param embyEmulation - The EmbyEmulation instance
     */
    constructor(embyEmulation: EmbyEmulation) {
        this.embyEmulation = embyEmulation;

        // Initialize REST based server
        this.app = express();

        // Log requests
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            logger.debug('Jellyfin', req.method, req.path);
            next();
        });

        // Allow remote clients to connect to the backend
        this.app.use(corsFor(() => embyEmulation.oblecto.config.server, {
            allowed: ['API-Token', 'Authorization', 'Content-Type', 'Range', 'X-Emby-Authorization', 'X-Emby-Token'],
            exposed: ['API-Token-Expiry', 'Content-Range', 'Accept-Ranges', 'Content-Length']
        }));

        // Parse Authorization header
        this.app.use((req: EmbyRequest, res: Response, next: NextFunction) => {
            if (req.headers.authorization !== undefined) {
                const parts = req.headers.authorization.split(' ');

                if (parts.length === 2) {
                    const scheme = parts[0];
                    const credentials = parts[1];

                    req.authorization = { scheme, credentials };
                }
            }
            next();
        });

        // Parse query parameters and body
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.json());

        // Serve web interface
        const staticPath = resolveJellyfinWebPath();
        this.app.use('/web', express.static(staticPath));

        this.app.get('/', (req, res) => {
            res.redirect('/web/index.html');
        });

        // Convert URL to lowercase
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const split = req.url.indexOf('?');
            req.url = split === -1 ? req.url.toLowerCase() : req.url.slice(0, split).toLowerCase() + req.url.slice(split);
            next();
        });

        // Parse Emby headers
        // Clients send it as Authorization or, older ones and jellyfin-web, as X-Emby-Authorization
        this.app.use((req: EmbyRequest, res: Response, next: NextFunction) => {
            const header = req.headers.authorization ?? req.headers['x-emby-authorization'];

            if (typeof header === 'string' && /^\s*(MediaBrowser|Emby)\b/i.test(header)) req.headers.emby = parseMediaBrowserHeader(header);

            next();
        });

        // Everything past this point needs a signed-in session
        this.app.use(sessionGuard(this.embyEmulation));

        // Add routes
        routes(this.app, this.embyEmulation);

        // Log unmatched routes. The path only: query strings carry api_key tokens.
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            logger.debug('Jellyfin route not implemented:', req.method, req.path);
            next();
        });

        // Error handling middleware

        this.app.use((err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
            if (err === null || err === undefined) return next();

            if (res.headersSent) return next(err);
            const statusCode = err.statusCode ?? 500;
            const message = err.message !== '' ? err.message : 'Internal Server Error';

            logger.error(`Jellyfin ${req.method} ${req.path}: HTTP ${statusCode} - ${message}`);

            res.status(statusCode).json({
                code: statusCode,
                message: message
            });
        });

        // Start express server
        const { port, host } = embyEmulation.oblecto.config.jellyfin;

        this.server = this.app.listen(port, host, () => {
            logger.info(`Jellyfin emulation server listening at http://${host}:${(this.server.address() as AddressInfo).port}`);
        });

        // A port already in use should not take the rest of Oblecto down with it.
        this.server.on('error', (error: NodeJS.ErrnoException) => {
            logger.error(`Jellyfin emulation server could not listen on ${host}:${port}: ${error.code ?? error.message}`);
        });
    }
}
