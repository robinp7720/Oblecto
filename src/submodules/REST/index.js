import restify from 'restify';
import routes from './routes';
import corsMiddleware from 'restify-cors-middleware';
import authMiddleware from './middleware/auth';

export default class OblectoAPI {
    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        // Initialize REST based server
        this.server = restify.createServer();

        // Allow remote clients to connect to the backend
        const cors = corsMiddleware({
            preflightMaxAge: 5, //Optional
            origins: ['*'],
            allowHeaders: ['API-Token', 'authorization'],
            exposeHeaders: ['API-Token-Expiry']
        });

        this.server.pre(cors.preflight);
        this.server.use(cors.actual);
        this.server.use(restify.plugins.authorizationParser());
        this.server.use(restify.plugins.queryParser({ mapParams: true }));
        this.server.use(restify.plugins.bodyParser({ mapParams: true }));

        // Added user authentication information to the request if the user is authenticated
        this.server.use(authMiddleware.addAuth);

        // Add routes routes
        routes(this.server, this.oblecto);

        // Start restify server
        this.server.listen(this.oblecto.config.server.port,  () => {
            console.log('%s listening at %s', this.server.name, this.server.url);
        });

    }
}
