import restify from 'restify';
import routes from './routes';
import corsMiddleware from 'restify-cors-middleware2';

export default class EmbyServerAPI {
    /**
     * @param {EmbyEmulation} embyEmulation
     */
    constructor(embyEmulation) {
        this.embyEmulation = embyEmulation;

        // Initialize REST based server
        this.server = restify.createServer();

        // Allow remote clients to connect to the backend
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

        this.server.pre(function(req, res, next) {
            req.url = req.url.toLowerCase();
            next();
        });

        this.server.pre(function(req, res, next) {
            if (!req.headers['x-emby-authorization']) return next();

            req.headers['emby'] = req.headers['x-emby-authorization'].split(', ');

            let auth = {};

            for (let i in req.headers['emby']) {
                let item = req.headers['emby'][i].split('=');

                auth[item[0]] = item[1].replace(/"/g, '');
            }

            req.headers['emby'] = auth;

            next();
        });

        this.server.use(async function (request, response) {
            console.log(request.url, request.params, request.method);
        });

        // Add routes
        routes(this.server, this.embyEmulation);

        // Start restify server
        this.server.listen(8096,  () => {
            console.log('Jellyfin emulation server listening at %s', this.server.url);
        });
    }
}
