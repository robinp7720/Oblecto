/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-optional-chain */
import express, { Request, Response, NextFunction } from 'express';
import routes from './routes/index.js';
import logger from '../logger/index.js';
import { corsFor } from '../../lib/network/cors.js';
import { Server } from 'http';
import Oblecto from '../../lib/oblecto/index.js';
import type { Permission } from '../../lib/auth/permissions.js';

export interface OblectoRequest extends Request {
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

        // Start express server
        // Express 5 calls this on failure too, with the error. Without its main port Oblecto is of no
        // use, so stop and let a supervisor such as systemd try again.
        const port = this.oblecto.config.server.port;

        this.server = app.listen(port, (error?: NodeJS.ErrnoException) => {
            if (error) throw new Error(`Could not listen on port ${port}: ${error.code ?? error.message}. Is another server already using it?`);

            logger.info( 'REST API Listening at', `http://localhost:${port}`);
        });
    }

    close(): Promise<void> {
        if (this.server && this.server.listening) {
            return new Promise((resolve, reject) => {
                this.server.close(err => {
                    if (err) {
                        logger.error( 'Error closing REST server:', err);
                        return reject(err);
                    }
                    logger.info( 'REST server closed successfully');
                    resolve();
                });
            });
        }
        return Promise.resolve();
    }
}
