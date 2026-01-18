import { Express, Response } from 'express';
import authMiddleWare from '../middleware/auth.js';

export default (server: Express, oblecto: any) => {
    server.get('/clients', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
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

    server.post('/client/:clientId/playback', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        let type = req.combined_params.type;
        let client = oblecto.realTimeController.clients[req.params.clientId];

        if (!client) {
            res.status(404).send({ message: 'Client not found' });
            return;
        }

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
