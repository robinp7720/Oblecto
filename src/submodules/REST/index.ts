import { HttpListener } from '../httpListener.js';
import express, { Request, Response, NextFunction } from 'express';
import routes from './routes/index.js';
import logger from '../logger/index.js';
import { corsFor } from '../../lib/network/cors.js';
import { Server } from 'http';
import Oblecto from '../../lib/oblecto/index.js';
import type { AccessClaims } from '../../lib/auth/tokens.js';
import type { Permission } from '../../lib/auth/permissions.js';

export interface OblectoRequest extends Request<Record<string, string>, unknown, Record<string, unknown>> {
    playbackRequestedAt?: number;
    authorization?: {
        scheme: string;
        credentials: string;
        user?: AccessClaims;
        // Loaded from the database once per request by requiresPermission
        principal?: { id: number; permissions: Permission[] } | null;
    };
    combined_params?: Record<string, unknown>;
}

export default class OblectoAPI {
    public oblecto: Oblecto;
    public server: Server;
    private listener: HttpListener;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        // Initialize REST based server
        const app = express();

        // Configure CORS
        app.use(corsFor(() => oblecto.config.server, {
            allowed: ['API-Token', 'Authorization', 'Content-Type', 'Range'],
            exposed: ['API-Token-Expiry', 'Content-Range', 'Accept-Ranges', 'Content-Length']
        }));

        // Parse Authorization header
        app.use((req: OblectoRequest, res: Response, next: NextFunction) => {
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
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());

        // Map query and body params to req.combined_params for compatibility with existing code
        app.use((req: OblectoRequest, res: Response, next: NextFunction) => {
            const body: unknown = req.body;
            if (body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body))) {
                res.status(400).json({ code: 400, message: 'Expected an object body' });
                return;
            }
            req.combined_params = { ...req.query, ...req.body };
            next();
        });

        // Initialize routes
        routes(app, this.oblecto);

        // Error handling middleware
        app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
            if (!err) return next();

            if (res.headersSent) return next(err);
            const details = typeof err === 'object' && err !== null ? err as Record<string, unknown> : {};
            const statusCode = typeof details.statusCode === 'number' && Number.isInteger(details.statusCode) && details.statusCode >= 400 && details.statusCode <= 599 ? details.statusCode : 500;
            const message = typeof details.message === 'string' && details.message ? details.message : 'Internal Server Error';

            logger.error( `HTTP ${statusCode} - ${message}`, err);

            res.status(statusCode).json({
                code: statusCode,
                message: message
            });
        });

        this.listener = new HttpListener(app);
        this.server = this.listener.server;
    }

    async start(): Promise<void> {
        const port = this.oblecto.config.server.port;
        try {
            await this.listener.start({ port });
        } catch (cause) {
            const error = cause as NodeJS.ErrnoException;
            throw new Error(`Could not listen on port ${port}: ${error.code ?? error.message}. Is another server already using it?`, { cause });
        }
        logger.info('REST API Listening at', `http://localhost:${port}`);
    }

    stop(): void { this.listener.stop(); }
    close(): Promise<void> { return this.listener.close(); }
}
