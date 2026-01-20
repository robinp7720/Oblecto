/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response } from 'express';
import authMiddleWare from '../middleware/auth.js';

export default (server: Express, oblecto: any) => {
    server.get('/clients', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        const clients = [];

        for (const clientId in oblecto.realTimeController.clients) {
            const client = oblecto.realTimeController.clients[clientId];

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
        const type = req.combined_params.type;
        const client = oblecto.realTimeController.clients[req.params.clientId];

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
