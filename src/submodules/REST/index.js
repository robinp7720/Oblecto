import jwt from "jsonwebtoken";
import restify from "restify";
import routes from './routes';
import corsMiddleware from "restify-cors-middleware";
import UserManager from "../../submodules/users";
import config from "../../config";

export default () => {

// Initialize REST based server
    const server = restify.createServer();

// Allow remote clients to connect to the backend
    const cors = corsMiddleware({
        preflightMaxAge: 5, //Optional
        origins: ['*'],
        allowHeaders: ['API-Token', 'authorization'],
        exposeHeaders: ['API-Token-Expiry']
    });

    server.pre(cors.preflight);
    server.use(cors.actual);
    server.use(restify.plugins.authorizationParser());
    server.use(restify.plugins.bodyParser({mapParams: true}));

// Added user authentication information to the request if the user is authenticated
    server.use(function (req, res, next) {
        if (req.authorization === undefined)
            return next();

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                return next();
            req.authorization.jwt = decoded;

            // Add user if user isn't already loaded into memory
            UserManager.userAdd(decoded);

            next();
        });
    });

// Add routes routes
    routes(server);

// Start restify server
    server.listen(config.server.port, function () {
        console.log('%s listening at %s', server.name, server.url);
    });

    return server;
};