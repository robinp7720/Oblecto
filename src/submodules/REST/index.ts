/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-optional-chain */
import { HttpListener } from '../httpListener.js';
import express, { Request, Response, NextFunction } from 'express';
import routes from './routes/index.js';
import logger from '../logger/index.js';
import { corsFor } from '../../lib/network/cors.js';
import { Server } from 'http';
import Oblecto from '../../lib/oblecto/index.js';
import type { Permission } from '../../lib/auth/permissions.js';

export interface OblectoRequest extends Request {
    playbackRequestedAt?: number;
    authorization?: {
        scheme: string;
        credentials: string;
        user?: any;
        // Loaded from the database once per request by requiresPermission
        principal?: { id: number; permissions: Permission[] } | null;
    };
    files?: any;
    combined_params?: Record<string, any>;
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
            req.combined_params = { ...req.query, ...req.body };
            next();
        });

        // Initialize routes
        routes(app, this.oblecto);

        // Error handling middleware
        app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            if (!err) return next();

            if (res.headersSent) return next(err);
            const statusCode = (err.statusCode as number) || 500;
            const message = (err.message as string) || 'Internal Server Error';

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
