import SeriesCollector from '../../../../lib/indexers/series/SeriesCollector';
import MovieCollector from '../../../../lib/indexers/movies/MovieCollector';

import SeriesArtworkRetriever from '../../../../lib/indexers/series/SeriesArtworkRetriever';
import MovieArtworkRetriever from '../../../../lib/indexers/movies/MovieArtworkRetriever';

import MovieCleaner from '../../../../lib/indexers/movies/MovieCleaner';
import SeriesCleaner from '../../../../lib/indexers/series/SeriesCleaner';

import authMiddleWare from '../../middleware/auth';

export default (server) => {
    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/index/:libraries', authMiddleWare.requiresAuth, function (req, res) {
        switch (req.params.libraries) {
        case 'tvshows':
            SeriesCollector.CollectAll();
            break;
        case 'movies':
            MovieCollector.CollectAll();
            break;
        case 'all':
            SeriesCollector.CollectAll();
            MovieCollector.CollectAll();
            break;
        }

        res.send([true]);
    });

    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/tvshows/download/art', authMiddleWare.requiresAuth, function (req, res) {
        SeriesArtworkRetriever.DownloadAll().catch((err) => {
            console.log(err);
        });

        res.send([true]);
    });


    server.get('/settings/maintenance/movies/download/art', authMiddleWare.requiresAuth, function (req, res) {
        MovieArtworkRetriever.DownloadAll().catch((err) => {
            console.log(err);
        });

        res.send([true]);
    });

    server.get('/settings/maintenance/clean/:type', authMiddleWare.requiresAuth, function (req, res) {

        switch  (req.params.type) {
        case 'movies':
            MovieCleaner.removeFileLessMovies();
            break;
        case 'tvshows':
            SeriesCleaner.removePathLessShows();
            SeriesCleaner.removeEpisodeslessShows();
            break;
        case 'episodes':
            SeriesCleaner.removeFileLessEpisodes();
            break;
        }

        res.send([true]);
    });

};