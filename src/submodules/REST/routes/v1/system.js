import authMiddleWare from '../../middleware/auth';
import errors from '../../errors';

export default (server, oblecto) => {

    // POST /api/v1/system/maintenance
    server.post('/api/v1/system/maintenance', authMiddleWare.requiresAuth, async (req, res, next) => {
        const { action, target, options } = req.body;

        if (!action || !target) {
            return next(new errors.BadRequestError('Action and target are required'));
        }

        try {
            switch (action) {
                case 'scan':
                    if (target === 'tvshows' || target === 'all') oblecto.seriesCollector.collectAll();
                    if (target === 'movies' || target === 'all') oblecto.movieCollector.collectAll();
                    break;

                case 'update_artwork':
                    if (target === 'tvshows' || target === 'all') oblecto.seriesArtworkCollector.collectAll();
                    if (target === 'movies' || target === 'all') oblecto.movieArtworkCollector.collectAll();
                    break;

                case 'update_metadata':
                    if (target === 'tvshows' || target === 'all') {
                        oblecto.seriesUpdateCollector.collectAllSeries();
                        oblecto.seriesUpdateCollector.collectAllEpisodes();
                    }
                    if (target === 'movies' || target === 'all') oblecto.movieUpdateCollector.collectAllMovies();
                    if (target === 'files' || target === 'all') oblecto.fileUpdateCollector.collectAllFiles();
                    break;

                case 'clean':
                    if (target === 'files' || target === 'all') {
                        oblecto.fileCleaner.removeAssoclessFiles();
                        oblecto.fileCleaner.removedDeletedFiled();
                    }
                    if (target === 'movies' || target === 'all') oblecto.movieCleaner.removeFileLessMovies();
                    if (target === 'tvshows' || target === 'all') {
                        oblecto.seriesCleaner.removeEpisodeslessShows();
                        oblecto.seriesCleaner.removePathLessShows();
                        oblecto.seriesCleaner.removeFileLessEpisodes();
                    }
                    break;

                default:
                    return next(new errors.BadRequestError('Invalid action'));
            }
            
            res.send({ success: true, message: `Maintenance task '${action}' triggered for '${target}'` });

        } catch (err) {
            next(err);
        }
    });

    // POST /api/v1/system/imports
    server.post('/api/v1/system/imports', authMiddleWare.requiresAuth, async (req, res, next) => {
        const { source, type } = req.body;

        if (!type) return next(new errors.BadRequestError('Type is required (movies|tvshows)'));
        
        const device = source || 'all'; // Default to all

        try {
            if (type === 'movies') {
                if (device === 'all') {
                    oblecto.seedboxController.importAllMovies();
                } else {
                    const seedbox = oblecto.seedboxController.seedBoxes[device];
                    if (!seedbox) return next(new errors.NotFoundError(`Seedbox '${device}' not found`));
                    oblecto.seedboxController.importMovies(seedbox);
                }
            } else if (type === 'tvshows') {
                 if (device === 'all') {
                    oblecto.seedboxController.importAllEpisodes();
                } else {
                    const seedbox = oblecto.seedboxController.seedBoxes[device];
                    if (!seedbox) return next(new errors.NotFoundError(`Seedbox '${device}' not found`));
                    oblecto.seedboxController.importEpisodes(seedbox);
                }
            } else {
                return next(new errors.BadRequestError('Invalid type'));
            }

            res.send({ success: true, message: `Import triggered for '${type}' from '${device}'` });

        } catch (err) {
            next(err);
        }
    });

    // GET /api/v1/system/info
    server.get('/api/v1/system/info', authMiddleWare.requiresAuth, (req, res) => {
        const info = {
            version: process.env.npm_package_version || 'unknown', // Assuming npm start or similar
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            nodeVersion: process.version,
            memory: process.memoryUsage()
        };
        res.send(info);
    });
};
