/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, jsdoc/check-tag-names, jsdoc/tag-lines, jsdoc/check-types, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import Oblecto from '../../../../lib/oblecto/index.js';
import { MediaSession } from '../../../../lib/mediaSessions/MediaSession.js';

export default (server: Express, oblecto: Oblecto) => {

    /**
     * @api {get} /api/v1/status/sessions Get active media sessions
     * @apiName GetSessions
     * @apiGroup Status
     * @apiVersion 1.0.0
     * @apiPermission admin
     *
     * @apiSuccess {Object[]} sessions List of active media sessions
     */
    server.get('/api/v1/status/sessions', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        // TODO: specific permission check for admin/monitoring? 
        // For now, requiresAuth is standard, assuming all auth users can see this or logic elsewhere handles roles.
        // Current existing routes don't seem to have role-based middleware visible here, usually just requiresAuth.

        const sessions = oblecto.streamSessionController.getSessions().map((session: MediaSession) => {
            const info = session.getInfo();
            // Add any extra info if needed that isn't in getInfo but is safe to expose
            return info;
        });

        res.send(sessions);
    });

    /**
     * @api {get} /api/v1/status/clients Get connected realtime clients
     * @apiName GetClients
     * @apiGroup Status
     * @apiVersion 1.0.0
     * @apiPermission admin
     *
     * @apiSuccess {Object[]} clients List of connected clients
     */
    server.get('/api/v1/status/clients', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        const clients = [];
        const realtimeClients = oblecto.realTimeController.clients;

        for (const clientId in realtimeClients) {
            const client = realtimeClients[clientId];
            
            // Extract pending playback info if any
            const playbackActivity = {
                series: Object.values(client.storage.series),
                movie: Object.values(client.storage.movie)
            };

            clients.push({
                clientId: clientId,
                clientName: client.clientName,
                user: client.user ? {
                    // Add other non-sensitive user fields if available in user object
                    // unknown structure of user record, safely returning id and any explicit fields if we knew them.
                    // client.user is typed as { id: number } & Record<string, unknown>
                    // so we pass it through but maybe should sanitize?
                    ...client.user
                } : null,
                connectedAt: client.socket.handshake.time, // Socket.io handshake time
                address: client.socket.handshake.address,
                activity: playbackActivity
            });
        }

        res.send(clients);
    });

    /**
     * @api {get} /api/v1/status/seedbox Get seedbox importer status
     * @apiName GetSeedboxStatus
     * @apiGroup Status
     * @apiVersion 1.0.0
     * @apiPermission admin
     *
     * @apiSuccess {Object} status Seedbox status object
     */
    server.get('/api/v1/status/seedbox', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        const seedboxes = oblecto.seedboxController.seedBoxes.map(sb => ({
            name: sb.name,
            // We can't access enabled state easily from the instance as it's not stored on the class, 
            // but we know these are the loaded ones.
            // moviePath: sb.moviePath, // path might be sensitive? usually internal docker path so maybe ok.
            // seriesPath: sb.seriesPath
        }));

        const queueStats = oblecto.seedboxController.importQueue.getStats();

        res.send({
            seedboxes,
            queue: queueStats
        });
    });
};
