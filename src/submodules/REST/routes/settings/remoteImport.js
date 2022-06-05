import authMiddleWare from '../../middleware/auth';

/**
 * @typedef {import('../../../../lib/oblecto').default} Oblecto
 * @typedef {import('restify/lib/server')} Server
 */

/**
 *
 * @param {Server} server - Restify server object
 * @param {Oblecto} oblecto - Oblecto server instance
 */
export default (server, oblecto) => {
    server.get('/remote-import/all/movies', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seedboxController.importAllMovies();
        res.send([true]);
    });

    // API Endpoint to request a re-index of certain library types
    server.get('/remote-import/:device/movies', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seedboxController.importMovies(oblecto.seedboxController.seedBoxes[req.params.device]);
        res.send([true]);
    });

    server.get('/remote-import/all/series', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seedboxController.importAllEpisodes();
        res.send([true]);
    });

    server.get('/remote-import/:device/series', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seedboxController.importEpisodes(oblecto.seedboxController.seedBoxes[req.params.device]);
        res.send([true]);
    });
};
