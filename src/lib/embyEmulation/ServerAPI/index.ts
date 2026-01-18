import express, { type Request, type Response, type NextFunction, type Application } from 'express';
import routes from './routes/index.js';
import cors from 'cors';
import logger from '../../../submodules/logger/index.js';

import type EmbyEmulation from '../index.js';

type EmbyRequest = Request & {
    authorization?: { scheme: string; credentials: string };
    headers: Request['headers'] & { emby?: Record<string, string> };
};

/**
 * Parses a header/string of the form:
 *   MediaBrowser Client="Jellyfin Media Player", Device="Tria", DeviceId="…", Version="1.12.0", Token="…"
 * into a plain JavaScript object:
 *   {
 *     Client: "Jellyfin Media Player",
 *     Device: "Tria",
 *     DeviceId: "…",
 *     Version: "1.12.0",
 *     Token: "…"
 *   }
 * @param headerStr
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
    public server: Application | ReturnType<Application['listen']>;

    /**
     * @param embyEmulation
     */
    constructor(embyEmulation: EmbyEmulation) {
        this.embyEmulation = embyEmulation;

        // Initialize REST based server
        this.server = express();

        // Log requests
        this.server.use((req: Request, res: Response, next: NextFunction) => {
            logger.debug(req.url, req.query, req.method);
            next();
        });

        // Allow remote clients to connect to the backend
        this.server.use(cors({
            origin: '*',
            maxAge: 5,
            allowedHeaders: ['API-Token', 'Authorization', 'Content-Type'],
            exposedHeaders: ['API-Token-Expiry']
        }));

        // Parse Authorization header
        this.server.use((req: EmbyRequest, res: Response, next: NextFunction) => {
            if (req.headers.authorization) {
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
        this.server.use(express.urlencoded({ extended: true }));
        this.server.use(express.json());

        // Convert URL to lowercase
        this.server.use((req: Request, res: Response, next: NextFunction) => {
            req.url = req.url.toLowerCase();
            next();
        });

        // Parse Emby headers
        this.server.use((req: EmbyRequest, res: Response, next: NextFunction) => {
            if (!req.headers.authorization) return next();

            req.headers.emby = parseMediaBrowserHeader(req.headers.authorization);

            next();
        });

        // Add routes
        routes(this.server, this.embyEmulation);

        // Log unmatched routes
        this.server.use((req: Request, res: Response, next: NextFunction) => {
            logger.debug('Route remained unmatched:', req.url, (res.locals as { _data?: unknown })._data);
            next();
        });

        // Error handling middleware
        this.server.use((err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
            if (!err) return next();

            const statusCode = err.statusCode || 500;
            const message = err.message || 'Internal Server Error';

            console.error(`HTTP ${statusCode} - ${message}`);

            res.status(statusCode).json({
                code: statusCode,
                message: message
            });
        });

        // Start express server
        this.server = (this.server as Application).listen(8096, () => {
            logger.info('Jellyfin emulation server listening at http://localhost:8096');
        });
    }
}
