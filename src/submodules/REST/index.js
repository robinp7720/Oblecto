import restify from 'restify';
import routes from './routes';
import logger from '../logger';
import corsMiddleware from 'restify-cors-middleware2';

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
        this.server = restify.createServer({ 'name': 'Oblecto' });

        const cors = corsMiddleware({
            preflightMaxAge: 5, // Optional
            origins: ['*'],
            allowHeaders: ['API-Token'],
            exposeHeaders: ['API-Token-Expiry']
        });

        this.server.pre(cors.preflight);
        this.server.use(cors.actual);

        this.server.use(restify.plugins.authorizationParser());
        this.server.use(restify.plugins.queryParser({ mapParams: true }));
        this.server.use(restify.plugins.bodyParser({ mapParams: true }));

        // Add routes
        routes(this.server, this.oblecto);

        // Start restify server
        this.server.listen(this.oblecto.config.server.port,  () => {
            logger.log('INFO', this.server.name, 'REST API Listening at', this.server.url);
        });
    }

    close() {
        this.server.close();
    }
}
