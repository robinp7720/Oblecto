import authMiddleWare from '../../middleware/auth';

/**
 *
 * @param server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/index/:libraries', authMiddleWare.requiresAuth, function (req, res) {
        switch (req.params.libraries) {
        case 'tvshows':
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
    server.get('/settings/maintenance/tvshows/download/art', authMiddleWare.requiresAuth, function (req, res) {
        oblecto.seriesArtworkCollector.collectAll();
        res.send([true]);
    });


    server.get('/settings/maintenance/movies/download/art', authMiddleWare.requiresAuth, function (req, res) {
        oblecto.movieArtworkCollector.collectAll();

        res.send([true]);
    });

    server.get('/settings/maintenance/clean/:type', authMiddleWare.requiresAuth, function (req, res) {

        switch  (req.params.type) {
        case 'files':

            break;
        case 'movies':

            break;
        case 'tvshows':

            break;
        case 'episodes':

            break;
        }

        res.send([true]);
    });

};
