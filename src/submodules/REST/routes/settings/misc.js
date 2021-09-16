import authMiddleWare from '../../middleware/auth';
import errors from 'restify-errors';
import { ConfigManager } from '../../../../config';

import Oblecto from '../../../../lib/oblecto';
import Server from 'restify/lib/server';

/**
 *
 * @param {Server} server - Restify server object
 * @param {Oblecto} oblecto - Oblecto server instance
 */
export default (server, oblecto) => {
    // API Endpoint to request a re-index of certain library types
    server.get('/settings/:setting', authMiddleWare.requiresAuth, function (req, res, next) {
        if (!oblecto.config[req.params.setting]) return next(new errors.NotFoundError('Setting does not exist'));

        res.send(oblecto.config[req.params.setting]);
    });

    server.put('/settings/:setting', authMiddleWare.requiresAuth, function (req, res, next) {
        if (!oblecto.config[req.params.setting]) return next(new errors.NotFoundError('Setting does not exist'));

        oblecto.config[req.params.setting] = req.body;

        ConfigManager.saveConfig();

        res.send(oblecto.config[req.params.setting]);

        return next();
    });

};
