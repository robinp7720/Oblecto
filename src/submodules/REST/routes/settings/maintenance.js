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
    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/index/:libraries', authMiddleWare.requiresAuth, async function (req, res) {
        switch (req.params.libraries) {
            case 'series':
                oblecto.seriesCollector.collectAll();
                break;
            case 'movies':
                oblecto.movieCollector.collectAll();
                break;
            case 'all':
                oblecto.seriesCollector.collectAll();
                oblecto.movieCollector.collectAll();
                break;
        }

        res.send([true]);
    });

    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/series/download/art', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seriesArtworkCollector.collectAll();
        res.send([true]);
    });

    server.get('/settings/maintenance/movies/download/art', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.movieArtworkCollector.collectAll();
        res.send([true]);
    });

    server.get('/settings/maintenance/update/series', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seriesUpdateCollector.collectAllSeries();
        res.send([true]);
    });

    server.get('/settings/maintenance/update/episodes', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.seriesUpdateCollector.collectAllEpisodes();
        res.send([true]);
    });

    server.get('/settings/maintenance/update/movies', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.movieUpdateCollector.collectAllMovies();
        res.send([true]);
    });

    server.get('/settings/maintenance/update/files', authMiddleWare.requiresAuth, async function (req, res) {
        oblecto.fileUpdateCollector.collectAllFiles();
        res.send([true]);
    });

    server.get('/settings/maintenance/clean/:type', authMiddleWare.requiresAuth, async function (req, res) {
        switch  (req.params.type) {
            case 'files':
                oblecto.fileCleaner.removeAssoclessFiles();
                oblecto.fileCleaner.removedDeletedFiled();
                break;
            case 'movies':
                oblecto.movieCleaner.removeFileLessMovies();
                break;
            case 'series':
                oblecto.seriesCleaner.removeEpisodeslessShows();
                oblecto.seriesCleaner.removePathLessShows();
                break;
            case 'episodes':
                oblecto.seriesCleaner.removeFileLessEpisodes();
                break;
        }

        res.send([true]);
    });

};
