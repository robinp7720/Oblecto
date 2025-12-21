import express from 'express';
import routes from './routes';
import logger from '../logger';
import cors from 'cors';
import fileUpload from 'express-fileupload';

/**
 * @typedef {import('../../lib/oblecto').default} Oblecto
 */

export default class OblectoAPI {
    /**
     * @param {Oblecto} oblecto - Oblecto instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        // Initialize REST based server
        const app = express();

        this.server = app;
        // this.server.name = 'Oblecto';

        // Configure CORS
        app.use(cors({
            origin: '*',
            maxAge: 5,
            allowedHeaders: ['API-Token'],
            exposedHeaders: ['API-Token-Expiry']
        }));

        app.use(fileUpload({
            useTempFiles: true,
            tempFileDir: '/tmp/'
        }));

        // Parse Authorization header
        app.use((req, res, next) => {
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
        app.use((req, res, next) => {
            req.combined_params = { ...req.query, ...req.body };
            next();
        });

        // Initialize routes
        routes(app, this.oblecto);

        // Error handling middleware
        app.use((err, req, res, next) => {
            if (!err) return next();

            const statusCode = err.statusCode || 500;
            const message = err.message || 'Internal Server Error';

            logger.error( `HTTP ${statusCode} - ${message}`, err);

            res.status(statusCode).json({
                code: statusCode,
                message: message
            });
        });

        // Start express server
        this.server = app.listen(this.oblecto.config.server.port, () => {
            logger.info( 'REST API Listening at', `http://localhost:${this.oblecto.config.server.port}`);
        });
    }

    close() {
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
