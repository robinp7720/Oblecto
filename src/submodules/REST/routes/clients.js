import authMiddleWare from '../middleware/auth';

/**
 * @typedef {import('../../../lib/oblecto').default} Oblecto
 * @typedef {import('restify/lib/server')} Server
 */

/**
 *
 * @param {Server} server - Restify server object
 * @param {Oblecto} oblecto - Oblecto server instance
 */
export default (server, oblecto) => {
    server.get('/clients', authMiddleWare.requiresAuth, async function (req, res) {
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
    });

    server.post('/client/:clientId/playback', authMiddleWare.requiresAuth, async function (req, res) {
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
    });
};
