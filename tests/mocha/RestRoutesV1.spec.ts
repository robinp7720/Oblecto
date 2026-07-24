import assert from 'node:assert/strict';
import librariesRoutes from '../../src/submodules/REST/routes/v1/libraries.js';
import settingsRoutes from '../../src/submodules/REST/routes/v1/settings.js';
import statusRoutes from '../../src/submodules/REST/routes/v1/status.js';
import systemRoutes from '../../src/submodules/REST/routes/v1/system.js';
import { ConfigManager } from '../../src/config.js';

const makeServer = () => {
    const handlers = new Map();
    const register = (method: string) => (route: string, ...routeHandlers: any[]) => {
        handlers.set(`${method} ${route}`, routeHandlers[routeHandlers.length - 1]);
    };
    return { handlers, get: register('GET'), post: register('POST'), put: register('PUT'), delete: register('DELETE'), patch: register('PATCH') };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    send(payload: any) { this.body = payload; return this; }
});

// v1/libraries.ts and v1/settings.ts call ConfigManager.saveConfig(), which writes
// to disk (potentially the repo's real res/config.json). Stub it out for all of
// these route tests so nothing is ever written to disk.
describe('v1 REST routes', () => {
    const originalSaveConfig = ConfigManager.saveConfig;
    let saveCount = 0;

    beforeEach(() => {
        saveCount = 0;
        ConfigManager.saveConfig = () => { saveCount++; };
    });

    afterEach(() => {
        ConfigManager.saveConfig = originalSaveConfig;
    });

    describe('libraries route', () => {
        const makeOblecto = () => ({
            config: {
                movies: { directories: [{ path: '/movies' }], movieIdentifiers: ['tmdb'] },
                tvshows: { directories: [{ path: '/tv' }] }
            }
        });

        it('lists allowed library sections', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/libraries')({} as any, res);

            assert.deepEqual(Object.keys(res.body).sort(), ['movies', 'tvshows']);
        });

        it('returns directories for a specific library type', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const res = makeRes();
            const next = (err: any) => { throw err; };
            await server.handlers.get('GET /api/v1/libraries/:type')({ params: { type: 'movies' } } as any, res, next);

            assert.deepEqual(res.body, [{ path: '/movies' }]);
        });

        it('rejects an invalid library type', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            let error: any;
            await server.handlers.get('GET /api/v1/libraries/:type')({ params: { type: 'bogus' } } as any, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 400);
        });

        it('adds a new library path and persists the config', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const req: any = { params: { type: 'movies' }, body: { path: '/new/movies' } };
            const res = makeRes();
            await server.handlers.get('POST /api/v1/libraries/:type/paths')(req, res, (err: any) => { throw err; });

            assert.deepEqual(res.body, [{ path: '/movies' }, { path: '/new/movies' }]);
            assert.equal(saveCount, 1);
        });

        it('rejects adding a duplicate library path', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const req: any = { params: { type: 'movies' }, body: { path: '/movies' } };
            let error: any;
            await server.handlers.get('POST /api/v1/libraries/:type/paths')(req, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 409);
        });

        it('removes a library path and persists the config', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const req: any = { params: { type: 'movies' }, body: { path: '/movies' } };
            const res = makeRes();
            await server.handlers.get('DELETE /api/v1/libraries/:type/paths')(req, res, (err: any) => { throw err; });

            assert.deepEqual(res.body, []);
            assert.equal(saveCount, 1);
        });

        it('404s removing a path that does not exist', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const req: any = { params: { type: 'movies' }, body: { path: '/nope' } };
            let error: any;
            await server.handlers.get('DELETE /api/v1/libraries/:type/paths')(req, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 404);
        });

        it('patches library settings and persists the config', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            librariesRoutes(server as any, oblecto as any);

            const req: any = { params: { type: 'movies' }, body: { movieIdentifiers: ['tmdb', 'tvdb'] } };
            const res = makeRes();
            await server.handlers.get('PATCH /api/v1/libraries/:type')(req, res, (err: any) => { throw err; });

            assert.deepEqual(oblecto.config.movies.movieIdentifiers, ['tmdb', 'tvdb']);
            assert.equal(saveCount, 1);
        });
    });

    describe('settings route', () => {
        const makeOblecto = () => ({
            config: {
                authentication: { secret: 'shh', saltRounds: 10, allowPasswordlessLogin: false },
                federation: { key: 'topsecret', enable: false },
                queue: { concurrency: 1 },
                seedboxes: [{ name: 'sb', storageDriverOptions: { password: 'boxpw' } }]
            }
        });

        it('scrubs secrets from the full settings dump', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            settingsRoutes(server as any, oblecto as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/settings')({} as any, res);

            assert.equal(res.body.authentication.secret, '***');
            assert.equal(res.body.federation.key, '***');
            assert.equal(res.body.seedboxes[0].storageDriverOptions.password, '***');
            // Original config is untouched
            assert.equal(oblecto.config.authentication.secret, 'shh');
        });

        it('scrubs the secret for a single section', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            settingsRoutes(server as any, oblecto as any);

            const res = makeRes();
            const next = (err: any) => { throw err; };
            await server.handlers.get('GET /api/v1/settings/:section')({ params: { section: 'authentication' } } as any, res, next);

            assert.equal(res.body.secret, '***');
        });

        it('rejects an invalid settings section', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            settingsRoutes(server as any, oblecto as any);

            let error: any;
            await server.handlers.get('GET /api/v1/settings/:section')({ params: { section: 'bogus' } } as any, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 400);
        });

        it('patches a single section and persists the config', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            settingsRoutes(server as any, oblecto as any);

            const req: any = { params: { section: 'queue' }, body: { concurrency: 5 } };
            await server.handlers.get('PATCH /api/v1/settings/:section')(req, makeRes(), (err: any) => { throw err; });

            assert.equal(oblecto.config.queue.concurrency, 5);
            assert.equal(saveCount, 1);
        });

        it('rejects a multi-section patch containing an invalid section', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            settingsRoutes(server as any, oblecto as any);

            const req: any = { body: { bogusSection: {} } };
            let error: any;
            await server.handlers.get('PATCH /api/v1/settings')(req, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 400);
        });

        it('applies a valid multi-section patch and returns scrubbed config', async () => {
            const oblecto = makeOblecto();
            const server = makeServer();
            settingsRoutes(server as any, oblecto as any);

            const req: any = { body: { queue: { concurrency: 9 } } };
            const res = makeRes();
            await server.handlers.get('PATCH /api/v1/settings')(req, res, (err: any) => { throw err; });

            assert.equal(oblecto.config.queue.concurrency, 9);
            assert.equal(res.body.authentication.secret, '***');
        });
    });

    describe('status route', () => {
        it('lists active media session info', async () => {
            const oblecto = {
                streamSessionController: { getSessions: () => [{ getInfo: () => ({ sessionId: 'abc' }) }] }
            };
            const server = makeServer();
            statusRoutes(server as any, oblecto as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/status/sessions')({} as any, res);

            assert.deepEqual(res.body, [{ sessionId: 'abc' }]);
        });

        it('lists connected realtime clients with activity', async () => {
            const oblecto = {
                realTimeController: {
                    clients: {
                        c1: {
                            clientName: 'Phone', user: { id: 1 },
                            storage: { series: { 1: { a: 1 } }, movie: {} },
                            socket: { handshake: { time: 't', address: '1.2.3.4' } }
                        }
                    }
                }
            };
            const server = makeServer();
            statusRoutes(server as any, oblecto as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/status/clients')({} as any, res);

            assert.equal(res.body[0].clientId, 'c1');
            assert.equal(res.body[0].address, '1.2.3.4');
        });

        it('reports seedbox status with queue stats', async () => {
            const oblecto = {
                seedboxController: {
                    seedBoxes: [{ name: 'sb1' }],
                    importQueue: { getStats: () => ({ length: 0, running: 0, idle: true }) }
                }
            };
            const server = makeServer();
            statusRoutes(server as any, oblecto as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/status/seedbox')({} as any, res);

            assert.equal(res.body.seedboxes[0].name, 'sb1');
            assert.equal(res.body.queue.idle, true);
        });
    });

    describe('system route', () => {
        it('triggers a scan for the requested target', async () => {
            const calls: string[] = [];
            const oblecto = {
                seriesCollector: { collectAll: () => calls.push('series') },
                movieCollector: { collectAll: () => calls.push('movie') }
            };
            const server = makeServer();
            systemRoutes(server as any, oblecto as any);

            const req: any = { body: { action: 'scan', target: 'all' } };
            const res = makeRes();
            await server.handlers.get('POST /api/v1/system/maintenance')(req, res, (err: any) => { throw err; });

            assert.deepEqual(calls.sort(), ['movie', 'series']);
            assert.equal(res.body.success, true);
        });

        it('rejects maintenance requests missing action/target', async () => {
            const server = makeServer();
            systemRoutes(server as any, {} as any);

            let error: any;
            await server.handlers.get('POST /api/v1/system/maintenance')({ body: {} } as any, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 400);
        });

        it('rejects an unknown maintenance action', async () => {
            const server = makeServer();
            systemRoutes(server as any, {} as any);

            let error: any;
            const req: any = { body: { action: 'bogus', target: 'movies' } };
            await server.handlers.get('POST /api/v1/system/maintenance')(req, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 400);
        });

        it('triggers a full import for all seedboxes', async () => {
            let called = false;
            const oblecto = { seedboxController: { importAllMovies: () => { called = true; } } };
            const server = makeServer();
            systemRoutes(server as any, oblecto as any);

            const req: any = { body: { type: 'movies' } };
            await server.handlers.get('POST /api/v1/system/imports')(req, makeRes(), (err: any) => { throw err; });

            assert.equal(called, true);
        });

        it('404s importing from an unknown named seedbox', async () => {
            const oblecto = { seedboxController: { seedBoxes: [{ name: 'sb1' }] } };
            const server = makeServer();
            systemRoutes(server as any, oblecto as any);

            const req: any = { body: { type: 'movies', source: 'unknown-box' } };
            let error: any;
            await server.handlers.get('POST /api/v1/system/imports')(req, makeRes(), (err: any) => { error = err; });

            assert.equal(error.statusCode, 404);
        });

        it('reports system info', async () => {
            const server = makeServer();
            systemRoutes(server as any, {} as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/system/info')({} as any, res);

            assert.equal(res.body.platform, process.platform);
        });

        it('reports capabilities from the indexer/updater instances', async () => {
            const oblecto = {
                movieIndexer: { availableIdentifiers: ['tmdb'] },
                movieUpdater: { availableUpdaters: ['tmdb'] },
                seriesIndexer: { availableSeriesIdentifiers: ['tmdb', 'tvdb'], availableEpisodeIdentifiers: ['tmdb'] },
                seriesUpdater: { availableSeriesUpdaters: ['tmdb'], availableEpisodeUpdaters: ['tvdb'] }
            };
            const server = makeServer();
            systemRoutes(server as any, oblecto as any);

            const res = makeRes();
            await server.handlers.get('GET /api/v1/system/capabilities')({} as any, res);

            assert.deepEqual(res.body.movies.identifiers, ['tmdb']);
            assert.deepEqual(res.body.tvshows.seriesIdentifiers, ['tmdb', 'tvdb']);
        });
    });
});
