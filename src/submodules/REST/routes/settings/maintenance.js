import TVShowIndexer from '../../../../lib/indexers/tv/index';
import MovieIndexer from '../../../../lib/indexers/movies/index';
import TVShowArt from '../../../../lib/indexers/tv/art';

import authMiddleWare from '../../middleware/auth';

export default (server) => {
    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/index/:libraries', authMiddleWare.requiresAuth, function (req, res) {
        switch (req.params.libraries) {
        case 'tvshows':
            TVShowIndexer.indexAll();
            break;
        case 'movies':
            MovieIndexer.indexAll();
            break;
        case 'all':
            TVShowIndexer.indexAll();
            MovieIndexer.indexAll();
            break;
        }

        res.send([true]);
    });

    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/tvshows/download/art', authMiddleWare.requiresAuth, function (req, res) {
        TVShowArt.DownloadAll().catch((err) => {
            console.log(err);
        });

        res.send([true]);
    });

};