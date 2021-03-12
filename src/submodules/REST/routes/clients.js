import authMiddleWare from '../middleware/auth';

import Oblecto from '../../../../lib/oblecto';
import Server from 'restify/lib/server';

/**
 *
 * @param {Server} server - Restify server object
 * @param {Oblecto} oblecto - Oblecto server instance
 */
export default (server, oblecto) => {
    server.get('/clients', authMiddleWare.requiresAuth, async function (req, res, next) {
        let clients = [];

        for (let clientId in oblecto.realTimeController.clients) {
            let client = oblecto.realTimeController.clients[clientId];

            if (client.user.id === req.authorization.user.id) {
                clients.push({
                    clientId,
                    clientName: client.clientName
                });
            }
        }

        res.send(clients);

        return next();
    });

    server.post('/client/:clientId/playback', authMiddleWare.requiresAuth, async function (req, res, next) {
        let type = req.params.type;
        let client = oblecto.realTimeController.clients[req.params.clientId];

        switch (type) {
            case 'episode':
                client.playEpisode(req.params.id);
                break;
            case 'movie':
                client.playMovie(req.params.id);
                break;
        }
        res.send();

        return next();
    });
};
