import authMiddleWare from '../../middleware/auth';
import errors from 'restify-errors';

import { ConfigManager } from '../../../../config';




export default (server, oblecto) => {
    // API Endpoint to request a re-index of certain library types
    server.get('/sources/:type', authMiddleWare.requiresAuth, function (req, res, next) {

        if (['movies', 'tvshows'].indexOf(req.params.type) === -1) {
            return next(new errors.BadRequestError('Source type does not exist'));
        }

        res.send(oblecto.config[req.params.type].directories || {});
    });

    server.put('/sources/:type', authMiddleWare.requiresAuth, function (req, res, next) {

        if (['movies', 'tvshows'].indexOf(req.params.type) === -1) {
            return next(new errors.BadRequestError('Source type does not exist'));
        }

        if (!req.params.path) {
            return next(new errors.BadRequestError('No path specified'));
        }

        oblecto.config[req.params.type].directories.push({
            path: req.params.path
        });

        res.send('success');

        ConfigManager.saveConfig();
    });

    server.del('/sources/:type', authMiddleWare.requiresAuth, function (req, res, next) {

        if (['movies', 'tvshows'].indexOf(req.params.type) === -1) {
            return next(new errors.BadRequestError('Source type does not exist'));
        }

        if (!req.params.path) {
            return next(new errors.BadRequestError('No path specified'));
        }

        oblecto.config[req.params.type].directories.forEach((v, i) => {
            if (v.path === req.params.path) {
                delete oblecto.config[req.params.type].directories.splice(i, 1);
            }
        });

        res.send('success');

        ConfigManager.saveConfig();
    });

};
