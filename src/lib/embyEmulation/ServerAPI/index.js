import express from 'express';
import routes from './routes';
import cors from 'cors';

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
 * @param {string} headerStr
 * @returns {Object<string,string>}
 */
function parseMediaBrowserHeader(headerStr) {
    // 1) Remove the leading "MediaBrowser " (everything up to the first space)
    //    so we're left with: Client="…", Device="…", …
    const kvPart = headerStr.replace(/^[^ ]+\s*/, '');

    // 2) Use a regex to capture Key="Value" pairs
    //    (\w+) matches the key (alphanumeric/underscore)
    //    ="([^"]*)"  matches an equals sign, a double-quote, then any non-quote chars, then a closing quote
    const re = /(\w+)="([^"]*)"/g;

    const result = {};
    let match;

    while ((match = re.exec(kvPart)) !== null) {
        const key = match[1];
        const value = match[2];

        result[key] = value;
    }
    return result;
}

export default class EmbyServerAPI {
    /**
     * @param {EmbyEmulation} embyEmulation
     */
    constructor(embyEmulation) {
        this.embyEmulation = embyEmulation;

        // Initialize REST based server
        this.server = express();

        // Log requests
        this.server.use((req, res, next) => {
            console.log(req.url, req.params, req.method);
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
        this.server.use((req, res, next) => {
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

        // Map query and body params to req.params for compatibility with existing code
        this.server.use((req, res, next) => {
            req.params = {
                ...req.query, ...req.body, ...req.params
            };
            next();
        });

        // Convert URL to lowercase
        this.server.use((req, res, next) => {
            req.url = req.url.toLowerCase();
            next();
        });

        // Parse Emby headers
        this.server.use((req, res, next) => {
            if (!req.headers.authorization) return next();

            req.headers.emby = parseMediaBrowserHeader(req.headers.authorization);

            next();
        });

        // Add routes
        routes(this.server, this.embyEmulation);

        // Log unmatched routes
        this.server.use((req, res, next) => {
            console.log('Route remained unmatched:', req.url, res.locals._data);
            next();
        });

        // Error handling middleware
        this.server.use((err, req, res, next) => {
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
        this.server = this.server.listen(8096, () => {
            console.log('Jellyfin emulation server listening at http://localhost:8096');
        });
    }
}
