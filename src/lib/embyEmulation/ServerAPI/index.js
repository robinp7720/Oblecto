import restify from 'restify';
import routes from './routes';
import corsMiddleware from 'restify-cors-middleware2';

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
 *
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
            if (!req.headers.authorization) return next();

            req.headers.emby = parseMediaBrowserHeader(req.headers.authorization);

            next();
        });

        this.server.use(async function (request, response) {
            //console.log(request.url, request.params, request.method);
        });

        // Add routes
        routes(this.server, this.embyEmulation);

        this.server.on('after', function(req, resp, route, error) {
            if (route) return;

            console.log(req.url, resp._data);
        });

        // Start restify server
        this.server.listen(8096,  () => {
            console.log('Jellyfin emulation server listening at %s', this.server.url);
        });
    }
}
